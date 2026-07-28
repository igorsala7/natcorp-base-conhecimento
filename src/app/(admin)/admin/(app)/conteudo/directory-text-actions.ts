"use server";

import { z } from "zod";
import { generateObject } from "ai";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";
import { languageModel, hasAiKey, aiTimeout, ehTimeout } from "@/lib/ai/config";
import { resolveCategory, resolveTempTexto } from "@/lib/ai/prompts";
import type { Criatividade } from "@/lib/ai/creativity";
import { normalizeDoc } from "@/lib/blocks/convert";
import { blocksToText, blocksToMarkdown, richToText } from "@/lib/blocks/serialize";
import type { Block } from "@/lib/blocks/schema";
import { listTree, type TreeNode } from "@/lib/content/tree";
import { saveArticle, type TextoAcao, type TomAlvo } from "./article-actions";

/**
 * "Melhorar texto" no DIRETÓRIO (Fase 1). Duas partes:
 *  A) melhorar o texto de cada artigo, bloco a bloco (preserva a estrutura —
 *     tabelas/callouts/imagens intactos; só a prosa muda);
 *  B) mover o conteúdo do FIM de um artigo que pertence ao PRÓXIMO (irmão).
 * Tudo PROPÕE (com antes/depois); o cliente aplica só o que o usuário confirmar.
 */

// ── util: caminhar os blocos de PROSA (têm .text) ────────────────────────────
const PROSA = new Set(["paragraph", "heading", "quote", "listItem"]);
function filhos(b: Block): Block[] {
  return "children" in b && Array.isArray(b.children) ? (b.children as Block[]) : [];
}

/** Texto puro de cada bloco de prosa, na ordem do documento (inclui vazios). */
function textosProsa(blocks: Block[]): string[] {
  const out: string[] = [];
  const walk = (bs: Block[]) => {
    for (const b of bs) {
      if (PROSA.has(b.type)) out.push(richToText((b as { text?: never }).text));
      const k = filhos(b);
      if (k.length) walk(k);
    }
  };
  walk(blocks);
  return out;
}

/** Reescreve o .text dos blocos de prosa por índice (só onde mudou); marcas do
 *  bloco alterado se perdem — troca aceitável, e só nos que realmente mudam. */
function substituirProsa(blocks: Block[], mapa: Map<number, string>): Block[] {
  let i = 0;
  const rebuild = (bs: Block[]): Block[] =>
    bs.map((b) => {
      let nb = b;
      if (PROSA.has(b.type)) {
        const idx = i++;
        const novo = mapa.get(idx);
        if (novo != null && novo !== richToText((b as { text?: never }).text)) {
          nb = { ...b, text: [{ text: novo }] } as Block;
        }
      }
      const k = filhos(nb);
      if (k.length) nb = { ...nb, children: rebuild(k) } as Block;
      return nb;
    });
  return rebuild(blocks);
}

async function spaceIdOfNode(
  supabase: Awaited<ReturnType<typeof createClient>>,
  nodeId: string,
): Promise<string | null> {
  const { data } = await supabase.from("nodes").select("space_id").eq("id", nodeId).single();
  return data?.space_id ?? null;
}

/** Lê o doc do nó, rascunho primeiro (como o editor e o improveLayout). */
async function lerDoc(
  supabase: Awaited<ReturnType<typeof createClient>>,
  nodeId: string,
): Promise<{ version: 2; blocks: Block[] }> {
  const [{ data: draft }, { data: article }] = await Promise.all([
    supabase.from("article_drafts").select("content_json").eq("node_id", nodeId).maybeSingle(),
    supabase.from("articles").select("content_json").eq("node_id", nodeId).maybeSingle(),
  ]);
  return normalizeDoc(draft?.content_json ?? article?.content_json);
}

// ── Parte A: melhorar o texto de UM artigo (por bloco) ───────────────────────

export type PropostaTexto =
  | { ok: true; mudou: boolean; nodeId: string; titulo: string; antes: string; depois: string; doc: object }
  | { ok: false; error: string };

const loteSchema = z.object({
  itens: z.array(z.object({ i: z.number().int(), texto: z.string() })),
});

/** Melhora os trechos em lote (1 chamada por artigo, em pedaços se for grande). */
async function melhorarLote(
  trechos: { i: number; texto: string }[],
  acao: TextoAcao,
  tom: TomAlvo | undefined,
  criatividade: Criatividade | undefined,
): Promise<Map<number, string>> {
  const P = await resolveCategory("ia_no_texto");
  const instrucao = acao === "tom" ? `${P.tom} Tom pedido: ${P[`tom_${tom ?? "formal"}`]}.` : P[acao] ?? "";
  const temperature = criatividade ? await resolveTempTexto(criatividade) : undefined;
  const mapa = new Map<number, string>();

  // Pedaços de ~6000 caracteres para não estourar o prompt.
  const pedacos: { i: number; texto: string }[][] = [];
  let atual: { i: number; texto: string }[] = [];
  let chars = 0;
  for (const t of trechos) {
    if (chars > 6000 && atual.length) {
      pedacos.push(atual);
      atual = [];
      chars = 0;
    }
    atual.push(t);
    chars += t.texto.length;
  }
  if (atual.length) pedacos.push(atual);

  for (const pedaco of pedacos) {
    const lista = pedaco.map((t) => `[${t.i}] ${t.texto}`).join("\n\n");
    const { object } = await generateObject({
      model: await languageModel("editor_text"),
      schema: loteSchema,
      abortSignal: aiTimeout("editor_text"),
      ...(temperature !== undefined ? { temperature } : {}),
      system: P.sistema,
      prompt: `${instrucao}\n\nAplique a instrução a CADA trecho abaixo. Devolva { itens: [{ i, texto }] } com o MESMO índice i de cada trecho; um item por trecho, sem juntar nem dividir. Não invente conteúdo novo.\n\nTRECHOS:\n${lista}`,
    });
    for (const it of object.itens) {
      if (Number.isInteger(it.i) && it.texto?.trim()) mapa.set(it.i, it.texto.trim());
    }
  }
  return mapa;
}

export async function proporTextoArtigo(
  nodeId: string,
  opts: { acao: TextoAcao; tom?: TomAlvo; criatividade?: Criatividade },
): Promise<PropostaTexto> {
  const supabase = await createClient();
  const spaceId = await spaceIdOfNode(supabase, nodeId);
  if (!spaceId) return { ok: false, error: "Nó não encontrado." };
  try {
    await requirePermission("content.edit", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }
  if (!(await hasAiKey("editor_text"))) {
    return { ok: false, error: "Configure um provedor de IA em Sistema → IA." };
  }
  const { data: node } = await supabase.from("nodes").select("title").eq("id", nodeId).single();
  const titulo = node?.title ?? "Artigo";

  const doc = await lerDoc(supabase, nodeId);
  const todos = textosProsa(doc.blocks);
  const trechos = todos
    .map((texto, i) => ({ i, texto: texto.trim() }))
    .filter((t) => t.texto.length >= 8); // trechos ínfimos não valem uma chamada
  if (!trechos.length) {
    return { ok: true, mudou: false, nodeId, titulo, antes: "", depois: "", doc };
  }

  try {
    const mapa = await melhorarLote(trechos, opts.acao, opts.tom, opts.criatividade);
    const novos = substituirProsa(doc.blocks, mapa);
    const antes = blocksToText(doc.blocks);
    const depois = blocksToText(novos);
    return { ok: true, mudou: antes !== depois, nodeId, titulo, antes, depois, doc: { version: 2, blocks: novos } };
  } catch (e) {
    if (ehTimeout(e)) return { ok: false, error: "A IA demorou demais neste artigo." };
    console.error("[directory-text] falha:", e);
    return { ok: false, error: "Falha ao consultar a IA." };
  }
}

// ── ordem de leitura dos artigos da subárvore ────────────────────────────────

export async function directoryArticlesOrdered(
  nodeId: string,
): Promise<{ ok: true; artigos: { id: string; title: string }[] } | { ok: false; error: string }> {
  const supabase = await createClient();
  const spaceId = await spaceIdOfNode(supabase, nodeId);
  if (!spaceId) return { ok: false, error: "Nó não encontrado." };
  try {
    await requirePermission("content.edit", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }
  const tree = await listTree(spaceId);
  const achar = (nodes: TreeNode[]): TreeNode | null => {
    for (const n of nodes) {
      if (n.id === nodeId) return n;
      const f = achar(n.children ?? []);
      if (f) return f;
    }
    return null;
  };
  const raiz = achar(tree);
  const artigos: { id: string; title: string }[] = [];
  const dfs = (nodes: TreeNode[]) => {
    for (const n of nodes) {
      if (n.type === "article") artigos.push({ id: n.id, title: n.title });
      dfs(n.children ?? []);
    }
  };
  dfs(raiz ? (raiz.children ?? []) : []);
  return { ok: true, artigos };
}

// ── Parte B: mover conteúdo do fim de A para o início de B ────────────────────

export type PropostaMigracao =
  | {
      ok: true;
      mover: boolean;
      deNodeId: string;
      deTitulo: string;
      paraNodeId: string;
      paraTitulo: string;
      blocosIds: string[];
      previa: string;
      motivo: string;
    }
  | { ok: false; error: string };

const migracaoSchema = z.object({
  mover: z.boolean(),
  blocosIds: z.array(z.string()),
  motivo: z.string(),
});

export async function proporMigracao(
  deNodeId: string,
  paraNodeId: string,
): Promise<PropostaMigracao> {
  const supabase = await createClient();
  const spaceId = await spaceIdOfNode(supabase, deNodeId);
  if (!spaceId) return { ok: false, error: "Nó não encontrado." };
  try {
    await requirePermission("content.edit", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }
  if (!(await hasAiKey("editor_text"))) return { ok: false, error: "IA não configurada." };

  const [{ data: nA }, { data: nB }] = await Promise.all([
    supabase.from("nodes").select("title").eq("id", deNodeId).single(),
    supabase.from("nodes").select("title").eq("id", paraNodeId).single(),
  ]);
  const deTitulo = nA?.title ?? "A";
  const paraTitulo = nB?.title ?? "B";
  const [docA, docB] = await Promise.all([lerDoc(supabase, deNodeId), lerDoc(supabase, paraNodeId)]);

  // Só os ÚLTIMOS blocos de topo de A são candidatos a "rabo".
  const caudaA = docA.blocks.slice(-6);
  if (!caudaA.length) return okSemMover(deNodeId, deTitulo, paraNodeId, paraTitulo);
  const listaA = caudaA.map((b) => `[${b.id}] ${blocosResumo([b])}`).join("\n");
  const inicioB = blocksToMarkdown(docB.blocks.slice(0, 2)).slice(0, 1200);

  try {
    const { object } = await generateObject({
      model: await languageModel("editor_text"),
      schema: migracaoSchema,
      abortSignal: aiTimeout("editor_text"),
      prompt: `Dois artigos de documentação CONSECUTIVOS. Analise se os ÚLTIMOS blocos do artigo A na verdade pertencem ao COMEÇO do artigo B (pelo título e pelo assunto) — texto/imagens que ficaram no fim de A mas são a introdução/continuação de B.

ARTIGO A: "${deTitulo}" — últimos blocos (id → resumo), do mais antigo ao mais recente:
${listaA}

ARTIGO B: "${paraTitulo}" — começo:
${inicioB || "(vazio)"}

Se e SÓ SE houver blocos do FIM de A que claramente pertencem a B, devolva mover=true e blocosIds = os ids desses blocos (têm que ser um SUFIXO contíguo do fim de A). Senão mover=false e blocosIds=[]. Explique em "motivo" (curto). Na dúvida, NÃO mova.`,
    });

    const idsCauda = caudaA.map((b) => b.id);
    // valida: subconjunto da cauda E sufixo contíguo do fim de A.
    const pedidos = object.blocosIds.filter((id) => idsCauda.includes(id));
    const sufixo = validarSufixo(docA.blocks, pedidos);
    if (!object.mover || !sufixo.length) {
      return { ok: true, mover: false, deNodeId, deTitulo, paraNodeId, paraTitulo, blocosIds: [], previa: "", motivo: object.motivo ?? "" };
    }
    const previa = blocksToText(docA.blocks.filter((b) => sufixo.includes(b.id))).slice(0, 600);
    return { ok: true, mover: true, deNodeId, deTitulo, paraNodeId, paraTitulo, blocosIds: sufixo, previa, motivo: object.motivo ?? "" };
  } catch (e) {
    if (ehTimeout(e)) return { ok: false, error: "A IA demorou demais." };
    console.error("[directory-text] migração falhou:", e);
    return { ok: false, error: "Falha ao consultar a IA." };
  }
}

function okSemMover(deNodeId: string, deTitulo: string, paraNodeId: string, paraTitulo: string): PropostaMigracao {
  return { ok: true, mover: false, deNodeId, deTitulo, paraNodeId, paraTitulo, blocosIds: [], previa: "", motivo: "" };
}

/** Reduz `ids` ao maior SUFIXO contíguo dos blocos de topo (o "rabo" real). */
function validarSufixo(blocks: Block[], ids: string[]): string[] {
  const set = new Set(ids);
  const sufixo: string[] = [];
  for (let k = blocks.length - 1; k >= 0; k--) {
    if (set.has(blocks[k]!.id)) sufixo.unshift(blocks[k]!.id);
    else break;
  }
  return sufixo;
}

/** Resumo curtinho de um bloco para a IA identificar (tipo + texto). */
function blocosResumo(blocks: Block[]): string {
  return blocks
    .map((b) => `${b.type}: ${blocksToText([b]).slice(0, 120)}`)
    .join(" | ");
}

export async function aplicarMigracao(
  deNodeId: string,
  paraNodeId: string,
  blocosIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const spaceId = await spaceIdOfNode(supabase, deNodeId);
  if (!spaceId) return { ok: false, error: "Nó não encontrado." };
  try {
    await requirePermission("content.edit", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }
  const [docA, docB] = await Promise.all([lerDoc(supabase, deNodeId), lerDoc(supabase, paraNodeId)]);
  const set = new Set(blocosIds);
  const movidos = docA.blocks.filter((b) => set.has(b.id));
  if (!movidos.length) return { ok: false, error: "Nada para mover." };
  const novoA = { version: 2 as const, blocks: docA.blocks.filter((b) => !set.has(b.id)) };
  const novoB = { version: 2 as const, blocks: [...movidos, ...docB.blocks] };
  const rA = await saveArticle(deNodeId, novoA);
  if (!rA.ok) return { ok: false, error: rA.error };
  const rB = await saveArticle(paraNodeId, novoB);
  if (!rB.ok) return { ok: false, error: rB.error };
  return { ok: true };
}
