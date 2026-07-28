"use server";

import { revalidatePath } from "next/cache";
import { generateText } from "ai";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";
import { audit } from "@/lib/auth/audit";
import { reindexNodeChunks } from "@/lib/content/chunk";
import {
  commitDraftIfAny,
  extractText,
  publishNodeCore,
  unpublishNodeCore,
} from "@/lib/content/publish-core";
import { languageModel, hasAiKey, aiTimeout, ehTimeout } from "@/lib/ai/config";
import { criarJobOntologia } from "@/lib/ai/ontology-enqueue";
import { enqueueOntologyScan } from "@/lib/jobs/boss";
import { createAdminClient } from "@/lib/supabase/admin";
import { improveLayout } from "@/lib/importer/improve";
import { proposeLayoutQuestions } from "@/lib/importer/questions";
import { resolveCategory, resolveTempLayout, resolveTempTexto } from "@/lib/ai/prompts";
import type { Criatividade } from "@/lib/ai/creativity";
import { normalizeDoc } from "@/lib/blocks/convert";
import { isBlockDoc, BlockDocSchema } from "@/lib/blocks/schema";
import { blocksToPlainWithImageMarkers } from "@/lib/blocks/serialize";
import type { Json } from "@/lib/database.types";

export type SaveResult = { ok: true } | { ok: false; error: string };
export type SaveDraftResult =
  | { ok: true; hasDraft: boolean }
  | { ok: false; error: string };

async function spaceIdOfNode(
  supabase: Awaited<ReturnType<typeof createClient>>,
  nodeId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("nodes")
    .select("space_id")
    .eq("id", nodeId)
    .single();
  return data?.space_id ?? null;
}

/**
 * Salva o conteúdo do artigo.
 * - Artigo PUBLICADO: as edições vão para `article_drafts` (rascunho). O portal
 *   continua servindo `content_json` (a versão publicada) — a página pública não
 *   muda até Publicar. Retorna `hasDraft: true`.
 * - Artigo em rascunho/revisão (sem página pública a proteger): grava direto em
 *   `content_json` e reindexa. Retorna `hasDraft: false`.
 */
export async function saveArticle(
  nodeId: string,
  contentJson: unknown,
): Promise<SaveDraftResult> {
  const supabase = await createClient();
  const spaceId = await spaceIdOfNode(supabase, nodeId);
  if (!spaceId) return { ok: false, error: "Nó não encontrado." };
  try {
    await requirePermission("content.edit", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão para editar." };
  }

  // Se já é um documento de blocos v2, valida antes de persistir (barra lixo).
  if (isBlockDoc(contentJson)) {
    const parsed = BlockDocSchema.safeParse(contentJson);
    if (!parsed.success) return { ok: false, error: "Documento de blocos inválido." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const now = new Date().toISOString();

  const { data: node } = await supabase
    .from("nodes")
    .select("status")
    .eq("id", nodeId)
    .single();

  // Artigo publicado → edição fica em rascunho (article_drafts), protegendo a
  // página pública, que segue servindo content_json.
  if (node?.status === "published") {
    // Rascunho NO-OP: se o conteúdo é IDÊNTICO ao publicado, NÃO cria/mantém
    // rascunho — senão o artigo aparece como "Rascunho"/"alterações não
    // publicadas" sem ter mudado nada (ex.: editar e desfazer, ou uma ação de
    // IA que devolve o mesmo). Compara normalizado (v1↔v2 dão o mesmo doc).
    const { data: art } = await supabase
      .from("articles")
      .select("content_json")
      .eq("node_id", nodeId)
      .maybeSingle();
    const igualAoPublicado =
      !!art &&
      JSON.stringify(normalizeDoc(contentJson)) === JSON.stringify(normalizeDoc(art.content_json));
    if (igualAoPublicado) {
      await supabase.from("article_drafts").delete().eq("node_id", nodeId);
      return { ok: true, hasDraft: false };
    }
    const { error } = await supabase
      .from("article_drafts")
      .upsert(
        { node_id: nodeId, content_json: contentJson as Json, updated_by: user?.id ?? null, updated_at: now },
        { onConflict: "node_id" },
      );
    if (error) return { ok: false, error: `Falha ao salvar: ${error.message}` };
    return { ok: true, hasDraft: true };
  }

  // Rascunho/revisão → grava direto em content_json e reindexa (busca).
  const text = extractText(contentJson);
  const { data: updated, error } = await supabase
    .from("articles")
    .update({
      content_json: contentJson as Json,
      content_text: text,
      excerpt: text.slice(0, 200),
      updated_by: user?.id ?? null,
      updated_at: now,
    })
    .eq("node_id", nodeId)
    .select("id, content_json")
    .single();
  if (error) return { ok: false, error: `Falha ao salvar: ${error.message}` };
  // Limpa rascunho remanescente (defensivo).
  await supabase.from("article_drafts").delete().eq("node_id", nodeId);

  if (updated) {
    await reindexNodeChunks(supabase, {
      nodeId,
      articleId: updated.id,
      spaceId,
      doc: updated.content_json as { type: string; content?: never[] },
    });
  }

  return { ok: true, hasDraft: false };
}

/** Descarta o rascunho pendente — o artigo volta ao conteúdo publicado. */
export async function discardDraft(nodeId: string): Promise<SaveResult> {
  const supabase = await createClient();
  const spaceId = await spaceIdOfNode(supabase, nodeId);
  if (!spaceId) return { ok: false, error: "Nó não encontrado." };
  try {
    await requirePermission("content.edit", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão para editar." };
  }
  const { error } = await supabase.from("article_drafts").delete().eq("node_id", nodeId);
  if (error) return { ok: false, error: `Falha: ${error.message}` };
  return { ok: true };
}

/**
 * "Melhorar layout": pede à IA para reformatar o texto do artigo em blocos
 * ricos (sem reescrever). Retorna o documento proposto SEM salvar — o usuário
 * revê e aplica no editor.
 */
export async function improveArticleLayout(
  nodeId: string,
  direcao?: string,
  criatividade?: Criatividade,
): Promise<{ ok: true; doc: object } | { ok: false; error: string }> {
  const temperature = criatividade ? await resolveTempLayout(criatividade) : undefined;
  const supabase = await createClient();
  const spaceId = await spaceIdOfNode(supabase, nodeId);
  if (!spaceId) return { ok: false, error: "Nó não encontrado." };
  try {
    await requirePermission("content.edit", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }

  // Rascunho primeiro: num artigo publicado a edição vive em article_drafts, e
  // ler content_json faria a IA reformatar a versão publicada — descartando
  // tudo que o usuário acabou de escrever. Mesma precedência da página do editor.
  const [{ data: draft }, { data: article }] = await Promise.all([
    supabase.from("article_drafts").select("content_json").eq("node_id", nodeId).maybeSingle(),
    supabase.from("articles").select("content_json").eq("node_id", nodeId).maybeSingle(),
  ]);
  const { text, images } = blocksToPlainWithImageMarkers(
    normalizeDoc(draft?.content_json ?? article?.content_json).blocks,
  );
  return improveLayout(text, images, direcao, temperature);
}

/**
 * "Melhorar layout" de uma SELEÇÃO: reformata só os blocos passados (do estado
 * do editor, não do banco) e pode DESMEMBRAR um bloco em vários (ex.: texto →
 * tabela → texto). `nodeId` serve só para a checagem de permissão. Retorna o
 * documento proposto SEM salvar — o editor substitui os blocos selecionados.
 */
export async function improveBlocks(
  nodeId: string,
  blocks: unknown,
  direcao?: string,
  criatividade?: Criatividade,
): Promise<{ ok: true; doc: object } | { ok: false; error: string }> {
  const temperature = criatividade ? await resolveTempLayout(criatividade) : undefined;
  const supabase = await createClient();
  const spaceId = await spaceIdOfNode(supabase, nodeId);
  if (!spaceId) return { ok: false, error: "Nó não encontrado." };
  try {
    await requirePermission("content.edit", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }
  if (!BlockDocSchema.safeParse({ version: 2, blocks }).success) {
    return { ok: false, error: "Seleção inválida." };
  }
  const { text, images } = blocksToPlainWithImageMarkers(normalizeDoc({ version: 2, blocks }).blocks);
  if (!text.trim()) return { ok: false, error: "Selecione blocos com texto para melhorar." };
  return improveLayout(text, images, direcao, temperature);
}

/**
 * Passe interativo do Melhorar layout: a IA lê o artigo (rascunho primeiro,
 * como o improve) e devolve perguntas de formatação DETALHADAS, citando os
 * trechos. As respostas viram a direção passada a improveArticleLayout.
 */
export async function proposeArticleLayoutQuestions(
  nodeId: string,
): Promise<
  { ok: true; perguntas: import("@/lib/importer/question-schema").LayoutQuestion[] } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const spaceId = await spaceIdOfNode(supabase, nodeId);
  if (!spaceId) return { ok: false, error: "Nó não encontrado." };
  try {
    await requirePermission("content.edit", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }
  const [{ data: draft }, { data: article }] = await Promise.all([
    supabase.from("article_drafts").select("content_json").eq("node_id", nodeId).maybeSingle(),
    supabase.from("articles").select("content_json").eq("node_id", nodeId).maybeSingle(),
  ]);
  const { text } = blocksToPlainWithImageMarkers(
    normalizeDoc(draft?.content_json ?? article?.content_json).blocks,
  );
  const r = await proposeLayoutQuestions(text, "detalhado");
  return r.ok ? { ok: true, perguntas: r.perguntas } : r;
}

// ── Melhorar layout de um DIRETÓRIO (lote recursivo) ────────────────────────

/** Ids dos artigos de um diretório e de TODA a subárvore abaixo dele. */
export async function directoryArticleIds(
  nodeId: string,
): Promise<{ ok: true; ids: string[] } | { ok: false; error: string }> {
  const supabase = await createClient();
  const spaceId = await spaceIdOfNode(supabase, nodeId);
  if (!spaceId) return { ok: false, error: "Nó não encontrado." };
  try {
    await requirePermission("content.edit", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }
  const { data: subtree } = await supabase.rpc("subtree_ids", { p_node_id: nodeId });
  const ids = (subtree ?? []).filter((r) => r.type === "article").map((r) => r.id);
  return { ok: true, ids };
}

/**
 * Perguntas de layout do DIRETÓRIO: amostra o texto dos artigos da subárvore e
 * gera preferências genéricas (uma direção só, aplicada a todos) — como na
 * importação. As respostas viram a `direcao` passada por artigo.
 */
export async function proposeDirectoryLayoutQuestions(
  nodeId: string,
): Promise<
  { ok: true; perguntas: import("@/lib/importer/question-schema").LayoutQuestion[] } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const spaceId = await spaceIdOfNode(supabase, nodeId);
  if (!spaceId) return { ok: false, error: "Nó não encontrado." };
  try {
    await requirePermission("content.edit", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }
  const { data: subtree } = await supabase.rpc("subtree_ids", { p_node_id: nodeId });
  const ids = (subtree ?? []).filter((r) => r.type === "article").map((r) => r.id);
  if (!ids.length) return { ok: false, error: "Nenhum artigo neste diretório." };

  const { data: arts } = await supabase
    .from("articles")
    .select("content_text")
    .in("node_id", ids)
    .limit(50);
  const partes: string[] = [];
  let total = 0;
  for (const a of arts ?? []) {
    if (total > 8000) break;
    const t = (a.content_text ?? "").slice(0, 1500);
    if (t.trim()) {
      partes.push(t);
      total += t.length;
    }
  }
  if (!partes.length) return { ok: false, error: "Sem texto para analisar." };
  const r = await proposeLayoutQuestions(partes.join("\n\n"), "generico");
  return r.ok ? { ok: true, perguntas: r.perguntas } : r;
}

/**
 * Melhora o layout de UM artigo E SALVA (roteando rascunho/publicado como o
 * editor). Usado pelo lote de diretório, um artigo por vez, com progresso.
 */
export async function improveNodeLayoutAndSave(
  nodeId: string,
  direcao?: string,
  criatividade?: Criatividade,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await improveArticleLayout(nodeId, direcao, criatividade);
  if (!r.ok) return r;
  const s = await saveArticle(nodeId, r.doc);
  return s.ok ? { ok: true } : { ok: false, error: s.error };
}

export type TextoAcao = "reescrever" | "expandir" | "resumir" | "tom" | "formatar";
export type TomAlvo = "formal" | "casual" | "tecnico";

// INSTRUCAO_TEXTO, TOM_LABEL e SISTEMA_IA_TEXTO vivem em @/lib/ai/prompt-defaults
// (um "use server" só pode exportar funções). Aqui são resolvidos com override.

/**
 * IA de texto do editor: reescrever, expandir, resumir ou mudar o tom de um
 * trecho. É outra política que a de "Melhorar layout" (que reformata sem
 * tocar no texto): aqui a IA PROPÕE texto novo — por isso a resposta nunca é
 * aplicada direto; o editor mostra antes/depois e o autor decide.
 */
export async function improveArticleText(
  nodeId: string,
  texto: string,
  acao: TextoAcao,
  tom?: TomAlvo,
  criatividade?: Criatividade,
): Promise<{ ok: true; proposta: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const spaceId = await spaceIdOfNode(supabase, nodeId);
  if (!spaceId) return { ok: false, error: "Nó não encontrado." };
  try {
    await requirePermission("content.edit", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }

  const trecho = texto.trim();
  if (trecho.length < 8) return { ok: false, error: "Selecione um trecho com mais texto." };
  if (trecho.length > 8000)
    return { ok: false, error: "Trecho grande demais — divida em partes menores." };
  if (!(await hasAiKey("editor_text")))
    return { ok: false, error: "Configure um provedor de IA em Sistema → IA." };

  const P = await resolveCategory("ia_no_texto");
  const instrucao =
    acao === "tom"
      ? `${P.tom} Tom pedido: ${P[`tom_${tom ?? "formal"}`]}.`
      : P[acao] ?? "";
  const temperature = criatividade ? await resolveTempTexto(criatividade) : undefined;

  try {
    const { text } = await generateText({
      model: await languageModel("editor_text"),
      abortSignal: aiTimeout("editor_text"),
      ...(temperature !== undefined ? { temperature } : {}),
      system: P.sistema,
      prompt: `${instrucao}\n\n<trecho>\n${trecho}\n</trecho>`,
    });
    const proposta = text.trim();
    if (!proposta) return { ok: false, error: "A IA devolveu uma resposta vazia. Tente de novo." };
    return { ok: true, proposta };
  } catch (e) {
    if (ehTimeout(e))
      return { ok: false, error: "A IA demorou demais para responder. Tente novamente." };
    // A causa real fica no log do servidor — a mensagem ao autor é curta, mas
    // sem isto o diagnóstico vira adivinhação (ex.: chave sem créditos).
    console.error("[editor_text] falha na chamada de IA:", e);
    return { ok: false, error: "Falha ao consultar a IA. Verifique o provedor em Sistema → IA." };
  }
}

/** Publica o nó (exige content.publish). content_html será gerado na Fase 2. */
export async function publishNode(nodeId: string): Promise<SaveResult> {
  const supabase = await createClient();
  const spaceId = await spaceIdOfNode(supabase, nodeId);
  if (!spaceId) return { ok: false, error: "Nó não encontrado." };
  try {
    await requirePermission("content.publish", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão para publicar." };
  }

  // Núcleo compartilhado com o agendador do worker: rascunho → oficial,
  // snapshot de versão e reindex com embeddings.
  const core = await publishNodeCore(supabase, nodeId, spaceId);
  if (!core.ok) return core;

  // Acopla a ontologia ao publicar, em SEGUNDO PLANO (embedding já saiu inline).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await enfileirarOntologiaPublicacao(spaceId, "article", nodeId, user?.id ?? null);

  await audit({
    action: "content.publish",
    entityType: "node",
    entityId: nodeId,
    spaceId,
  });
  revalidatePath("/admin/conteudo");
  return { ok: true };
}

/**
 * Enfileira a ontologia como EFEITO DE SISTEMA do publicar: a varredura de
 * termos (chamada de chat, mais lenta que o embedding) vai para a fila e não
 * trava o "Publicar". Usa cliente SERVICE-ROLE porque a RLS de `ontology_jobs`
 * exige `ai.configure` — que um Gestor de conteúdo não tem, mas ele publica.
 * `subtree` = UMA varredura para a pasta inteira (não um job por artigo).
 * Falha aqui nunca desfaz a publicação.
 */
async function enfileirarOntologiaPublicacao(
  spaceId: string,
  scope: "article" | "subtree",
  targetId: string,
  createdBy: string | null,
): Promise<void> {
  try {
    const jobId = await criarJobOntologia(createAdminClient(), {
      spaceId,
      scope,
      targetId,
      createdBy,
    });
    if (jobId) await enqueueOntologyScan(jobId);
  } catch {
    // Fila/DB indisponível: o conteúdo está publicado; a ontologia pode ser
    // gerada depois pela página de ontologia ou pelo lote "Processar".
  }
}

/**
 * Reindexa os chunks do artigo COM embeddings, sem precisar despublicar/publicar.
 * Útil para gerar embeddings de conteúdo já publicado antes de configurar a IA.
 */
export async function reindexArticleEmbeddings(
  nodeId: string,
): Promise<SaveResult> {
  const supabase = await createClient();
  const spaceId = await spaceIdOfNode(supabase, nodeId);
  if (!spaceId) return { ok: false, error: "Nó não encontrado." };
  try {
    await requirePermission("content.edit", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }
  const { data: art } = await supabase
    .from("articles")
    .select("id, content_json")
    .eq("node_id", nodeId)
    .maybeSingle();
  if (!art) return { ok: false, error: "Artigo não encontrado." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  await reindexNodeChunks(supabase, {
    nodeId,
    articleId: art.id,
    spaceId,
    doc: art.content_json as { type: string; content?: never[] },
    withEmbeddings: true,
    embeddedBy: user?.id ?? null,
  });
  await audit({ action: "content.reindex", entityType: "node", entityId: nodeId, spaceId });
  return { ok: true };
}

/**
 * Gera embeddings de TODOS os artigos da subárvore (pasta → artigos de todos
 * os níveis abaixo), sem publicar. Exige content.edit.
 */
export async function reindexSubtreeEmbeddings(
  nodeId: string,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const supabase = await createClient();
  const spaceId = await spaceIdOfNode(supabase, nodeId);
  if (!spaceId) return { ok: false, error: "Nó não encontrado." };
  try {
    await requirePermission("content.edit", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: subtree } = await supabase.rpc("subtree_ids", { p_node_id: nodeId });
  const articleIds = (subtree ?? []).filter((r) => r.type === "article").map((r) => r.id);
  let count = 0;
  for (const artNodeId of articleIds) {
    const { data: art } = await supabase
      .from("articles")
      .select("id, content_json")
      .eq("node_id", artNodeId)
      .maybeSingle();
    if (!art) continue;
    await reindexNodeChunks(supabase, {
      nodeId: artNodeId,
      articleId: art.id,
      spaceId,
      doc: art.content_json as { type: string; content?: never[] },
      withEmbeddings: true,
      embeddedBy: user?.id ?? null,
    });
    count += 1;
  }
  await audit({ action: "content.reindex_subtree", entityType: "node", entityId: nodeId, spaceId, after: { count } });
  return { ok: true, count };
}

/**
 * Publica um nó e TODA a subárvore (pasta → todos os filhos publicados),
 * gerando embeddings de cada artigo. Exige content.publish.
 */
export async function publishSubtree(
  nodeId: string,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const supabase = await createClient();
  const spaceId = await spaceIdOfNode(supabase, nodeId);
  if (!spaceId) return { ok: false, error: "Nó não encontrado." };
  try {
    await requirePermission("content.publish", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão para publicar." };
  }

  const { data: subtree } = await supabase.rpc("subtree_ids", {
    p_node_id: nodeId,
  });
  const ids = (subtree ?? []).map((r) => r.id);
  if (ids.length === 0) return { ok: false, error: "Nada a publicar." };

  const now = new Date().toISOString();
  await supabase
    .from("nodes")
    .update({ status: "published", published_at: now })
    .in("id", ids);

  // Reindexa (com embeddings) cada artigo da subárvore.
  const articleIds = (subtree ?? []).filter((r) => r.type === "article").map((r) => r.id);
  let count = 0;
  for (const artNodeId of articleIds) {
    const { data: art } = await supabase
      .from("articles")
      .select("id, content_json")
      .eq("node_id", artNodeId)
      .maybeSingle();
    if (!art) continue;
    // Rascunho pendente vira oficial antes do snapshot/reindex.
    await commitDraftIfAny(supabase, artNodeId);
    const { data: fresh } = await supabase
      .from("articles")
      .select("content_json")
      .eq("id", art.id)
      .maybeSingle();
    await supabase.from("articles").update({ published_at: now }).eq("id", art.id);
    await supabase.rpc("create_article_version", { p_node_id: artNodeId, p_label: "Publicação" });
    await reindexNodeChunks(supabase, {
      nodeId: artNodeId,
      articleId: art.id,
      spaceId,
      doc: (fresh?.content_json ?? art.content_json) as { type: string; content?: never[] },
      withEmbeddings: true,
    });
    count += 1;
  }

  // Ontologia acoplada: UMA varredura em lote para a pasta inteira (segundo
  // plano), em vez de um job por artigo. O embedding de cada artigo já saiu acima.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await enfileirarOntologiaPublicacao(spaceId, "subtree", nodeId, user?.id ?? null);

  await audit({ action: "content.publish_subtree", entityType: "node", entityId: nodeId, spaceId, after: { count } });
  revalidatePath("/admin/conteudo");
  return { ok: true, count };
}

/** Despublica (volta para rascunho). Exige content.publish. */
export async function unpublishNode(nodeId: string): Promise<SaveResult> {
  const supabase = await createClient();
  const spaceId = await spaceIdOfNode(supabase, nodeId);
  if (!spaceId) return { ok: false, error: "Nó não encontrado." };
  try {
    await requirePermission("content.publish", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão para despublicar." };
  }

  const core = await unpublishNodeCore(supabase, nodeId, spaceId, null);
  if (!core.ok) return core;

  await audit({
    action: "content.unpublish",
    entityType: "node",
    entityId: nodeId,
    spaceId,
  });
  revalidatePath("/admin/conteudo");
  return { ok: true };
}

/**
 * Promove TODOS os rascunhos pendentes de um espaço a conteúdo oficial.
 *
 * Seguro por construção: `saveArticle` só cria linha em `article_drafts` para
 * nós já publicados, então isto nunca torna público algo que não era. Artigos
 * nunca publicados ficam de fora de propósito — publicar conteúdo novo em
 * massa e sem querer é irreversível na prática, e essa decisão fica individual.
 *
 * Serve o "Publicar alterações pendentes" da edição em massa na prévia.
 */
export async function publishPendingDrafts(
  spaceId: string,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const supabase = await createClient();
  try {
    await requirePermission("content.publish", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão para publicar." };
  }

  // Duas consultas em vez de um join embutido: não dependo do PostgREST
  // inferir a relação reversa, e o erro (se houver) fica explícito.
  const { data: rascunhos } = await supabase.from("article_drafts").select("node_id");
  const comRascunho = (rascunhos ?? []).map((r) => r.node_id);
  if (comRascunho.length === 0) return { ok: true, count: 0 };

  // Filtra pelos que são deste espaço e seguem publicados.
  const { data: nodes } = await supabase
    .from("nodes")
    .select("id")
    .eq("space_id", spaceId)
    .eq("status", "published")
    .is("deleted_at", null)
    .in("id", comRascunho);

  const ids = (nodes ?? []).map((n) => n.id);
  if (ids.length === 0) return { ok: true, count: 0 };

  const now = new Date().toISOString();
  let count = 0;
  for (const nodeId of ids) {
    const promovido = await commitDraftIfAny(supabase, nodeId);
    if (!promovido) continue;
    count++;

    const { data: art } = await supabase
      .from("articles")
      .select("id, content_json")
      .eq("node_id", nodeId)
      .maybeSingle();
    if (!art) continue;

    await supabase.from("articles").update({ published_at: now }).eq("id", art.id);
    // Snapshot obrigatório a cada publicação (histórico append-only).
    await supabase.rpc("create_article_version", {
      p_node_id: nodeId,
      p_label: "Publicação em massa",
    });
    await reindexNodeChunks(supabase, {
      nodeId,
      articleId: art.id,
      spaceId,
      doc: art.content_json as { type: string; content?: never[] },
      withEmbeddings: true,
    });
  }

  await audit({
    action: "content.publish",
    entityType: "space",
    entityId: spaceId,
    spaceId,
    after: { publishedDrafts: count },
  });
  revalidatePath("/admin/conteudo");
  return { ok: true, count };
}

/** Estado de agendamento de um nó (para o diálogo "Agendar…"). */
export async function getSchedule(nodeId: string): Promise<{
  publishAt: string | null;
  unpublishAt: string | null;
  redirectTo: string | null;
}> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("nodes")
    .select("publish_at, unpublish_at, unpublish_redirect_to")
    .eq("id", nodeId)
    .maybeSingle();
  return {
    publishAt: data?.publish_at ?? null,
    unpublishAt: data?.unpublish_at ?? null,
    redirectTo: data?.unpublish_redirect_to ?? null,
  };
}

/** Artigos publicados do espaço (destinos possíveis do redirect ao despublicar). */
export async function listPublishedArticles(
  spaceId: string,
): Promise<{ id: string; title: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("nodes")
    .select("id, title")
    .eq("space_id", spaceId)
    .eq("type", "article")
    .eq("status", "published")
    .is("deleted_at", null)
    .order("title");
  return data ?? [];
}

/**
 * Agenda (ou cancela, com null) publicação e despublicação. O worker executa
 * a cada minuto com a MESMA lógica do publicar manual. Exige content.publish —
 * agendar É publicar, só que com data marcada.
 */
export async function setSchedule(
  nodeId: string,
  input: { publishAt: string | null; unpublishAt: string | null; redirectTo: string | null },
): Promise<SaveResult> {
  const supabase = await createClient();
  const spaceId = await spaceIdOfNode(supabase, nodeId);
  if (!spaceId) return { ok: false, error: "Nó não encontrado." };
  try {
    await requirePermission("content.publish", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão para agendar publicação." };
  }

  const instante = (v: string | null, rotulo: string): string | null | { erro: string } => {
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return { erro: `${rotulo}: data inválida.` };
    if (d.getTime() < Date.now() - 60_000) return { erro: `${rotulo}: escolha um horário futuro.` };
    return d.toISOString();
  };
  const pub = instante(input.publishAt, "Publicar");
  if (pub && typeof pub === "object") return { ok: false, error: pub.erro };
  const unpub = instante(input.unpublishAt, "Despublicar");
  if (unpub && typeof unpub === "object") return { ok: false, error: unpub.erro };
  if (pub && unpub && unpub <= pub)
    return { ok: false, error: "Despublicar precisa vir depois de publicar." };
  if (input.redirectTo && input.redirectTo === nodeId)
    return { ok: false, error: "O redirect não pode apontar para o próprio artigo." };

  const { error } = await supabase
    .from("nodes")
    .update({
      publish_at: pub,
      unpublish_at: unpub,
      unpublish_redirect_to: unpub ? input.redirectTo : null,
    })
    .eq("id", nodeId);
  if (error) return { ok: false, error: `Falha: ${error.message}` };

  await audit({
    action: "content.schedule",
    entityType: "node",
    entityId: nodeId,
    spaceId,
    after: { publish_at: pub, unpublish_at: unpub, redirect_to: unpub ? input.redirectTo : null },
  });
  revalidatePath("/admin/conteudo");
  return { ok: true };
}
