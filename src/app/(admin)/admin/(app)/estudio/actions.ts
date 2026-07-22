"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { generateObject } from "ai";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";
import { audit } from "@/lib/auth/audit";
import { languageModel, hasAiKey, aiTimeout, ehTimeout } from "@/lib/ai/config";
import { studioTurnSchema } from "@/lib/ai/studio-schema";
import { blocksSchema } from "@/lib/importer/layout-schema";
import { blocksToDoc, filtrarButtonsSemUrl } from "@/lib/importer/blocks-to-doc";
import { PADRAO_DE_ARTIGO } from "@/lib/importer/prompts";
import { extractDocument } from "@/lib/importer/extract";
import { generateKeyBetween } from "fractional-indexing";
import { uniqueSlug } from "@/lib/content/unique-slug";
import {
  aplicarOperacoes,
  aplicarPatch,
  acharNo,
  resumoDaProposta,
  type ProposalNode,
  type ProposalPatch,
  type StudioOp,
} from "@/lib/studio/proposal";
import type { Json } from "@/lib/database.types";
import type { LayoutQuestion } from "@/lib/importer/question-schema";

/**
 * Estúdio IA: conversa com um "editor sênior" que interpreta o pedido (texto
 * + anexos, inclusive CÓDIGO), pergunta antes de assumir, monta a proposta
 * (artigo único ou árvore) e gera os corpos artigo a artigo. Tudo nasce
 * RASCUNHO na materialização.
 */

export type StudioMsg = { role: "user" | "assistant"; text: string };
export type StudioSessionData = {
  id: string;
  spaceId: string;
  title: string;
  status: string;
  messages: StudioMsg[];
  proposal: ProposalNode[];
  parentId: string | null;
  materiais: { nome: string; chars: number }[];
};

const MAX_CONTEXTO = 24_000;
const MAX_MATERIAIS_TOTAL = 80_000;
const MAX_MSGS_ARMAZENADAS = 200;
const MSGS_NO_PROMPT = 16;

type Res<T> = { ok: true; data: T } | { ok: false; error: string };

type SessRow = {
  id: string;
  space_id: string;
  title: string;
  status: string;
  messages: Json;
  proposal: Json;
  target: Json;
  materiais: Json;
};

async function carregarSessao(
  sessionId: string,
): Promise<{ sess: SessRow; supabase: Awaited<ReturnType<typeof createClient>> } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("studio_sessions")
    .select("id, space_id, title, status, messages, proposal, target, materiais")
    .eq("id", sessionId)
    .maybeSingle();
  if (!data) return null;
  try {
    await requirePermission("content.create", data.space_id);
  } catch {
    return null;
  }
  return { sess: data, supabase };
}

function paraDados(sess: SessRow): StudioSessionData {
  const materiais = (sess.materiais as { nome: string; texto: string }[]) ?? [];
  return {
    id: sess.id,
    spaceId: sess.space_id,
    title: sess.title,
    status: sess.status,
    messages: (sess.messages as StudioMsg[]) ?? [],
    proposal: (sess.proposal as ProposalNode[]) ?? [],
    parentId: ((sess.target as { parentId?: string | null }) ?? {}).parentId ?? null,
    materiais: materiais.map((m) => ({ nome: m.nome, chars: m.texto?.length ?? 0 })),
  };
}

// ── Sessões ─────────────────────────────────────────────────────────────────

export async function createStudioSession(
  spaceId: string,
  parentId: string | null,
): Promise<Res<string>> {
  try {
    await requirePermission("content.create", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão para criar conteúdo." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("studio_sessions")
    .insert({
      space_id: spaceId,
      target: { parentId } as Json,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: `Falha: ${error?.message ?? "?"}` };
  revalidatePath("/admin/estudio");
  return { ok: true, data: data.id };
}

export async function getStudioSession(sessionId: string): Promise<StudioSessionData | null> {
  const ctx = await carregarSessao(sessionId);
  return ctx ? paraDados(ctx.sess) : null;
}

export async function listStudioSessions(
  spaceId: string,
): Promise<{ id: string; title: string; status: string; updated_at: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("studio_sessions")
    .select("id, title, status, updated_at")
    .eq("space_id", spaceId)
    .order("updated_at", { ascending: false })
    .limit(50);
  return data ?? [];
}

/** Patch granular do CLIENTE — o servidor mescla na proposal atual (um escritor só). */
export async function saveStudioState(
  sessionId: string,
  patches: ProposalPatch[],
  parentId?: string | null,
): Promise<Res<null>> {
  const ctx = await carregarSessao(sessionId);
  if (!ctx) return { ok: false, error: "Sessão não encontrada." };
  let proposal = (ctx.sess.proposal as ProposalNode[]) ?? [];
  for (const p of patches) proposal = aplicarPatch(proposal, p);
  const { error } = await ctx.supabase
    .from("studio_sessions")
    .update({
      proposal: proposal as unknown as Json,
      ...(parentId !== undefined ? { target: { parentId } as Json } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);
  if (error) return { ok: false, error: `Falha: ${error.message}` };
  return { ok: true, data: null };
}

// ── Anexos ──────────────────────────────────────────────────────────────────

/** Extensões tratadas como TEXTO PURO (código) — o extrator não as conhece. */
const EXT_TEXTO = /\.(sql|pks|pkb|js|ts|jsx|tsx|css|html|htm|json|xml|txt|md|markdown)$/i;

export async function studioAttach(input: {
  sessionId: string;
  path: string;
  name: string;
  mime: string | null;
}): Promise<Res<{ nome: string; chars: number }>> {
  const ctx = await carregarSessao(input.sessionId);
  if (!ctx) return { ok: false, error: "Sessão não encontrada." };
  if (!input.path.startsWith(`${ctx.sess.space_id}/`)) {
    return { ok: false, error: "Caminho inválido." };
  }
  const { data: file, error } = await ctx.supabase.storage.from("imports").download(input.path);
  if (error || !file) return { ok: false, error: "Não consegui baixar o arquivo." };

  let texto = "";
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    if (EXT_TEXTO.test(input.name)) {
      texto = buf.toString("utf8");
    } else {
      const extraido = await extractDocument(buf, input.name, input.mime ?? undefined);
      texto = extraido.blocks.map((b) => b.text).filter(Boolean).join("\n\n");
    }
  } catch (e) {
    return { ok: false, error: `Falha ao extrair: ${e instanceof Error ? e.message : "?"}` };
  }
  texto = texto.slice(0, MAX_CONTEXTO);
  if (!texto.trim()) return { ok: false, error: "O arquivo não tem texto extraível." };

  const materiais = ((ctx.sess.materiais as { nome: string; texto: string }[]) ?? []).slice();
  const totalAtual = materiais.reduce((n, m) => n + (m.texto?.length ?? 0), 0);
  if (totalAtual + texto.length > MAX_MATERIAIS_TOTAL) {
    return { ok: false, error: "Limite de material da sessão atingido — remova anexos ou resuma." };
  }
  materiais.push({ nome: input.name, texto });
  const { error: upErr } = await ctx.supabase
    .from("studio_sessions")
    .update({ materiais: materiais as unknown as Json, updated_at: new Date().toISOString() })
    .eq("id", input.sessionId);
  if (upErr) return { ok: false, error: `Falha: ${upErr.message}` };
  return { ok: true, data: { nome: input.name, chars: texto.length } };
}

// ── Turno da conversa ───────────────────────────────────────────────────────

export type TurnoResultado = {
  mensagem: string;
  perguntas: LayoutQuestion[] | null;
  avisos: string[];
  proposal: ProposalNode[];
  gerarCorpo: string[];
  diretivasCorpo: string | null;
};

export async function studioTurn(
  sessionId: string,
  mensagemUsuario: string,
): Promise<Res<TurnoResultado>> {
  const parsed = z.string().trim().min(1).max(4000).safeParse(mensagemUsuario);
  if (!parsed.success) return { ok: false, error: "Mensagem inválida." };
  const ctx = await carregarSessao(sessionId);
  if (!ctx) return { ok: false, error: "Sessão não encontrada." };
  if (!(await hasAiKey("editor_generate"))) {
    return { ok: false, error: "Nenhuma IA configurada (Sistema → IA)." };
  }

  const messages = ((ctx.sess.messages as StudioMsg[]) ?? []).slice();
  const proposal = (ctx.sess.proposal as ProposalNode[]) ?? [];
  const materiais = (ctx.sess.materiais as { nome: string; texto: string }[]) ?? [];

  const historico = messages
    .slice(-MSGS_NO_PROMPT)
    .map((m) => `${m.role === "user" ? "AUTOR" : "VOCÊ"}: ${m.text}`)
    .join("\n");
  const materiaisTxt = materiais
    .map((m) => `### MATERIAL "${m.nome}"\n${m.texto}`)
    .join("\n\n")
    .slice(0, MAX_CONTEXTO * 2);

  try {
    const { object } = await generateObject({
      model: await languageModel("editor_generate"),
      schema: studioTurnSchema,
      abortSignal: aiTimeout("editor_generate"),
      prompt: `Você é um EDITOR SÊNIOR de documentação corporativa, conversando em português do Brasil com o autor para criar conteúdo novo.

COMO TRABALHAR:
- Interprete o pedido e monte/ajuste a PROPOSTA (artigo único ou árvore de pastas+artigos) com as operações estruturais.
- PERGUNTE antes de assumir: quando faltar contexto, quando sua interpretação de um trecho for incerta (confirme-a explicitamente) e nas escolhas de layout — use "perguntas" com 2-4 opções e exemplo aplicado. Não pergunte o óbvio.
- CÓDIGO (PL/SQL, JavaScript, CSS, HTML, jQuery…): leia e descreva o PLANO DE AÇÃO (o que o código faz, em que ordem, condições e efeitos) para um artigo de orientação de funcionamento. CONFIRME com o autor os detalhes deduzidos (regras de negócio, nomes de telas, casos de erro) ANTES de afirmá-los como fato — nunca invente comportamento.
- Estrutura: crie pastas apenas quando o conteúdo pedir agrupamento; o LOCAL na árvore da documentação é escolhido pelo autor no seletor da tela (não pergunte o destino, ele está fora do seu alcance).
- Marque em "gerarCorpo" os artigos prontos para (re)gerar o corpo — só quando já houver contexto suficiente. Acumule preferências de estilo em "diretivasCorpo".
- "mensagem" sempre explica o que você fez e o que precisa do autor.

PROPOSTA ATUAL:
${proposal.length ? resumoDaProposta(proposal) : "(vazia)"}

${materiaisTxt ? `MATERIAIS DO AUTOR:\n${materiaisTxt}\n` : ""}
CONVERSA ATÉ AQUI:
${historico || "(início)"}

AUTOR AGORA DIZ:
${parsed.data}`,
    });

    const r = aplicarOperacoes(proposal, object.operacoes as StudioOp[], object.gerarCorpo);
    const novasMsgs: StudioMsg[] = [
      ...messages,
      { role: "user" as const, text: parsed.data },
      { role: "assistant" as const, text: object.mensagem },
    ].slice(-MAX_MSGS_ARMAZENADAS);

    const titulo =
      ctx.sess.title === "Nova conversa" && parsed.data.length > 3
        ? parsed.data.slice(0, 80)
        : ctx.sess.title;

    const { error } = await ctx.supabase
      .from("studio_sessions")
      .update({
        messages: novasMsgs as unknown as Json,
        proposal: r.proposal as unknown as Json,
        title: titulo,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);
    if (error) return { ok: false, error: `Falha ao salvar: ${error.message}` };

    return {
      ok: true,
      data: {
        mensagem: object.mensagem,
        perguntas: object.perguntas,
        avisos: r.avisos,
        proposal: r.proposal,
        gerarCorpo: r.gerarCorpo,
        diretivasCorpo: object.diretivasCorpo,
      },
    };
  } catch (e) {
    if (ehTimeout(e)) return { ok: false, error: "A IA demorou demais. Tente de novo." };
    return { ok: false, error: `Falha na IA: ${e instanceof Error ? e.message : "?"}` };
  }
}

// ── Corpo por artigo ────────────────────────────────────────────────────────

export async function studioGenerateBody(
  sessionId: string,
  tmpId: string,
  diretivas: string | null,
): Promise<Res<ProposalNode[]>> {
  const ctx = await carregarSessao(sessionId);
  if (!ctx) return { ok: false, error: "Sessão não encontrada." };
  const proposal = (ctx.sess.proposal as ProposalNode[]) ?? [];
  const no = acharNo(proposal, tmpId);
  if (!no || no.tipo !== "article") return { ok: false, error: "Artigo não encontrado na proposta." };

  const materiais = ((ctx.sess.materiais as { nome: string; texto: string }[]) ?? [])
    .map((m) => `### MATERIAL "${m.nome}"\n${m.texto}`)
    .join("\n\n")
    .slice(0, MAX_CONTEXTO);
  const messages = ((ctx.sess.messages as StudioMsg[]) ?? [])
    .slice(-MSGS_NO_PROMPT)
    .map((m) => `${m.role === "user" ? "AUTOR" : "EDITOR"}: ${m.text}`)
    .join("\n");

  try {
    const { object } = await generateObject({
      model: await languageModel("editor_generate"),
      schema: blocksSchema,
      abortSignal: aiTimeout("editor_generate"),
      prompt: `Escreva o CORPO do artigo de documentação "${no.titulo}" em blocos ricos, português do Brasil.

${PADRAO_DE_ARTIGO}

CONTEXTO DA PROPOSTA (não repita conteúdo de outros artigos):
${resumoDaProposta(proposal)}

${materiais ? `MATERIAIS (única fonte de fatos — onde faltar dado específico escreva [COMPLETAR]):\n${materiais}\n` : "Sem material de referência: seja genérico e correto; use [COMPLETAR] para dados específicos.\n"}
DECISÕES DA CONVERSA (respeite-as):
${messages || "(nenhuma)"}
${diretivas ? `\nDIRETRIZES DE FORMATO:\n${diretivas}` : ""}

Regras: NÃO inclua o título do artigo; comece com um parágrafo de abertura; use tabela para pares rótulo-valor, steps para procedimentos, callout com parcimônia, code para trechos técnicos. Estilo visual: deixe largura/posicao como null — o padrão da casa já formata; só defina se uma DIRETRIZ pedir explicitamente. NUNCA crie button a menos que a URL exata conste dos MATERIAIS (o sistema descarta).`,
    });
    // O estúdio não tem as guardas do improve — a de URL vale igual.
    const doc = blocksToDoc(filtrarButtonsSemUrl(object.blocks, materiais));
    const nova = aplicarPatch(proposal, { kind: "doc", tmpId, doc });
    const { error } = await ctx.supabase
      .from("studio_sessions")
      .update({ proposal: nova as unknown as Json, updated_at: new Date().toISOString() })
      .eq("id", sessionId);
    if (error) return { ok: false, error: `Falha ao salvar: ${error.message}` };
    return { ok: true, data: nova };
  } catch (e) {
    if (ehTimeout(e)) return { ok: false, error: `A IA demorou demais em "${no.titulo}".` };
    return { ok: false, error: `Falha na IA: ${e instanceof Error ? e.message : "?"}` };
  }
}

// ── Materialização ──────────────────────────────────────────────────────────

/** Cria a proposta como PASTAS + ARTIGOS RASCUNHO no destino. Rollback total. */
export async function materializeStudio(
  sessionId: string,
  parentId: string | null,
): Promise<Res<{ rootId: string | null }>> {
  const ctx = await carregarSessao(sessionId);
  if (!ctx) return { ok: false, error: "Sessão não encontrada." };
  const { supabase, sess } = ctx;
  const proposal = (sess.proposal as ProposalNode[]) ?? [];
  if (!proposal.length) return { ok: false, error: "A proposta está vazia." };

  if (parentId) {
    const { data: pai } = await supabase
      .from("nodes")
      .select("id, type, space_id")
      .eq("id", parentId)
      .maybeSingle();
    if (!pai || pai.space_id !== sess.space_id || pai.type !== "folder") {
      return { ok: false, error: "A pasta de destino não é válida." };
    }
  }

  const criados: string[] = [];
  let rootId: string | null = null;
  try {
    const inserir = async (
      nos: ProposalNode[],
      pai: string | null,
      prevPos: string | null,
    ): Promise<void> => {
      let prev = prevPos;
      for (const n of nos) {
        const slug = await uniqueSlug(supabase, sess.space_id, pai, n.titulo || "sem-titulo");
        prev = generateKeyBetween(prev, null);
        const { data: created, error } = await supabase
          .from("nodes")
          .insert({
            space_id: sess.space_id,
            parent_id: pai,
            type: n.tipo,
            title: n.titulo || "Sem título",
            slug,
            position: prev,
          })
          .select("id")
          .single();
        if (error || !created) throw new Error(error?.message ?? "insert falhou");
        criados.push(created.id);
        if (!rootId) rootId = created.id;
        if (n.tipo === "article") {
          const { error: aErr } = await supabase.from("articles").insert({
            node_id: created.id,
            content_json: (n.doc ?? {
              version: 2,
              blocks: [],
            }) as unknown as Json,
          });
          if (aErr) throw new Error(aErr.message);
        }
        if (n.children.length) await inserir(n.children, created.id, null);
      }
    };
    await inserir(proposal, parentId, null);
  } catch (e) {
    for (const id of [...criados].reverse()) {
      await supabase.from("nodes").delete().eq("id", id);
    }
    return { ok: false, error: `Falha ao criar: ${e instanceof Error ? e.message : "?"}` };
  }

  await supabase
    .from("studio_sessions")
    .update({ status: "created", target: { parentId } as Json, updated_at: new Date().toISOString() })
    .eq("id", sessionId);
  await audit({
    action: "content.studio_create",
    entityType: "studio_session",
    entityId: sessionId,
    spaceId: sess.space_id,
    after: { nodes: criados.length, parentId },
  });
  revalidatePath("/admin/conteudo");
  revalidatePath("/admin/estudio");
  return { ok: true, data: { rootId } };
}
