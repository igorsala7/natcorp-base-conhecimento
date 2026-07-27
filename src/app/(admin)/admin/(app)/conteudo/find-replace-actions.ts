"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";
import { audit } from "@/lib/auth/audit";
import { fetchAllPaged } from "@/lib/supabase/paginate";
import { normalizeDoc } from "@/lib/blocks/convert";
import { findMatches, replaceAll, richToPlain, type FindMatch } from "@/lib/blocks/find-replace";
import type { Block, RichText } from "@/lib/blocks/schema";
import { saveArticle } from "./article-actions";

/**
 * Localizar e substituir na DOCUMENTAÇÃO INTEIRA (todos os artigos de um
 * espaço), a partir da página /admin/conteudo. Reaproveita o mesmo motor do
 * Ctrl+F do editor (`findMatches`/`replaceAll`): age no texto rico dos blocos
 * (parágrafo, título, item de lista, citação, callout…) inclusive aninhados;
 * blocos cujo texto mora em `data` (tabela, checklist) ficam de fora nesta
 * versão. A troca em artigo PUBLICADO vira rascunho pendente (via `saveArticle`);
 * em rascunho, grava direto. Nada vai ao ar sem o usuário publicar.
 */

const MIN_TERM = 2;

type NodeRow = { id: string; parent_id: string | null; title: string; type: string; status: string };

export type FindHit = {
  nodeId: string;
  title: string;
  /** Ancestrais em "A › B › C" (sem o próprio artigo). */
  path: string;
  status: string;
  hasDraft: boolean;
  count: number;
  snippetBefore: string;
  snippetMatch: string;
  snippetAfter: string;
};

export type FindResult =
  | { ok: true; hits: FindHit[]; totalMatches: number; totalArticles: number }
  | { ok: false; error: string };

export type ReplaceResult =
  | { ok: true; artigos: number; ocorrencias: number; rascunhos: number; erros: number }
  | { ok: false; error: string };

/** Ancestrais de um nó como "A › B › C" (exclui o próprio nó). */
function caminhoDe(id: string, porId: Map<string, NodeRow>): string {
  const partes: string[] = [];
  const guarda = new Set<string>([id]);
  const cur = porId.get(id);
  let p = cur?.parent_id ? porId.get(cur.parent_id) : undefined;
  while (p && !guarda.has(p.id)) {
    guarda.add(p.id);
    partes.unshift(p.title);
    p = p.parent_id ? porId.get(p.parent_id) : undefined;
  }
  return partes.join(" › ");
}

/** Acha um bloco pelo id, descendo em `children`. */
function acharBloco(blocks: Block[], id: string): Block | null {
  for (const b of blocks) {
    if (b.id === id) return b;
    const ch = "children" in b ? (b.children as Block[] | undefined) : undefined;
    if (ch) {
      const achado = acharBloco(ch, id);
      if (achado) return achado;
    }
  }
  return null;
}

/** Trecho ao redor da 1ª ocorrência, para pré-visualizar na lista. */
function trechoDoMatch(blocks: Block[], m: FindMatch): { before: string; match: string; after: string } {
  const b = acharBloco(blocks, m.blockId);
  const rich = b ? ((b as { text?: RichText }).text ?? []) : [];
  const plain = richToPlain(rich);
  const R = 48;
  return {
    before: (m.start > R ? "…" : "") + plain.slice(Math.max(0, m.start - R), m.start),
    match: plain.slice(m.start, m.end),
    after: plain.slice(m.end, m.end + R) + (m.end + R < plain.length ? "…" : ""),
  };
}

type Alvo = { node: NodeRow; blocks: Block[]; hasDraft: boolean; matches: FindMatch[] };

/**
 * Coleta os artigos do espaço que contêm o termo, com os blocos EFETIVOS
 * (rascunho pendente sobre o publicado) e as posições casadas. Filtro grosseiro
 * por `content_text ilike` + os poucos rascunhos varridos inteiros — assim um
 * termo que só existe num rascunho também aparece.
 */
async function coletarAlvos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  spaceId: string,
  term: string,
  caseSensitive: boolean,
): Promise<{ porId: Map<string, NodeRow>; alvos: Alvo[]; totalArticles: number }> {
  const nodes = await fetchAllPaged<NodeRow>((from, to) =>
    supabase
      .from("nodes")
      .select("id, parent_id, title, type, status")
      .eq("space_id", spaceId)
      .order("id", { ascending: true })
      .range(from, to),
  );
  const porId = new Map(nodes.map((n) => [n.id, n]));
  const articleIds = nodes.filter((n) => n.type === "article").map((n) => n.id);
  if (!articleIds.length) return { porId, alvos: [], totalArticles: 0 };

  // Filtro grosseiro: artigos publicados cujo texto puro contém o termo.
  const esc = term.replace(/[\\%_]/g, (m) => `\\${m}`);
  const cand = new Set<string>();
  for (let i = 0; i < articleIds.length; i += 200) {
    const { data } = await supabase
      .from("articles")
      .select("node_id")
      .in("node_id", articleIds.slice(i, i + 200))
      .ilike("content_text", `%${esc}%`);
    for (const a of data ?? []) cand.add(a.node_id);
  }

  // Rascunhos pendentes (poucos): sobrescrevem o publicado e podem conter o termo.
  const draftByNode = new Map<string, unknown>();
  for (let i = 0; i < articleIds.length; i += 200) {
    const { data } = await supabase
      .from("article_drafts")
      .select("node_id, content_json")
      .in("node_id", articleIds.slice(i, i + 200));
    for (const d of data ?? []) draftByNode.set(d.node_id, d.content_json);
  }
  for (const [nodeId, cj] of draftByNode) {
    if (findMatches(normalizeDoc(cj).blocks, term, caseSensitive).length) cand.add(nodeId);
  }

  // content_json dos candidatos SEM rascunho.
  const precisaJson = [...cand].filter((id) => !draftByNode.has(id));
  const artByNode = new Map<string, unknown>();
  for (let i = 0; i < precisaJson.length; i += 200) {
    const { data } = await supabase
      .from("articles")
      .select("node_id, content_json")
      .in("node_id", precisaJson.slice(i, i + 200));
    for (const a of data ?? []) artByNode.set(a.node_id, a.content_json);
  }

  const alvos: Alvo[] = [];
  for (const nodeId of cand) {
    const node = porId.get(nodeId);
    if (!node) continue;
    const hasDraft = draftByNode.has(nodeId);
    const cj = hasDraft ? draftByNode.get(nodeId) : artByNode.get(nodeId);
    if (cj == null) continue;
    const blocks = normalizeDoc(cj).blocks;
    const matches = findMatches(blocks, term, caseSensitive);
    if (!matches.length) continue;
    alvos.push({ node, blocks, hasDraft, matches });
  }
  return { porId, alvos, totalArticles: articleIds.length };
}

/** Lista resumida dos artigos que contêm o termo (título, caminho, nº, trecho). */
export async function findInSpace(
  spaceId: string,
  term: string,
  opts?: { caseSensitive?: boolean },
): Promise<FindResult> {
  const q = term.trim();
  if (q.length < MIN_TERM) return { ok: false, error: `Digite ao menos ${MIN_TERM} caracteres.` };
  try {
    await requirePermission("content.view", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão para ver o conteúdo." };
  }
  const supabase = await createClient();
  const { porId, alvos, totalArticles } = await coletarAlvos(supabase, spaceId, q, !!opts?.caseSensitive);

  const hits: FindHit[] = alvos
    .map((a) => {
      const t = trechoDoMatch(a.blocks, a.matches[0]!);
      return {
        nodeId: a.node.id,
        title: a.node.title,
        path: caminhoDe(a.node.id, porId),
        status: a.node.status,
        hasDraft: a.hasDraft,
        count: a.matches.length,
        snippetBefore: t.before,
        snippetMatch: t.match,
        snippetAfter: t.after,
      };
    })
    .sort((x, y) => `${x.path} ${x.title}`.localeCompare(`${y.path} ${y.title}`, "pt"));

  const totalMatches = hits.reduce((s, h) => s + h.count, 0);
  return { ok: true, hits, totalMatches, totalArticles };
}

/**
 * Substitui o termo por `replacement` em todos os artigos do espaço (ou só nos
 * `nodeIds` informados). Publicado → rascunho pendente; rascunho → direto.
 * `replacement` vazio remove o termo.
 */
export async function replaceInSpace(
  spaceId: string,
  term: string,
  replacement: string,
  opts?: { caseSensitive?: boolean; nodeIds?: string[] },
): Promise<ReplaceResult> {
  const q = term.trim();
  if (q.length < MIN_TERM) return { ok: false, error: `Digite ao menos ${MIN_TERM} caracteres.` };
  if (replacement === q) return { ok: false, error: "O texto de substituição é igual ao buscado." };
  try {
    await requirePermission("content.edit", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão para editar." };
  }
  const supabase = await createClient();
  const { alvos } = await coletarAlvos(supabase, spaceId, q, !!opts?.caseSensitive);
  const permitir = opts?.nodeIds?.length ? new Set(opts.nodeIds) : null;

  let artigos = 0;
  let ocorrencias = 0;
  let rascunhos = 0;
  let erros = 0;
  for (const a of alvos) {
    if (permitir && !permitir.has(a.node.id)) continue;
    const { blocks, count } = replaceAll(a.blocks, q, replacement, !!opts?.caseSensitive);
    if (!count) continue;
    const r = await saveArticle(a.node.id, { version: 2, blocks });
    if (r.ok) {
      artigos++;
      ocorrencias += count;
      if (r.hasDraft) rascunhos++;
    } else {
      erros++;
    }
  }

  await audit({
    action: "content.find_replace",
    entityType: "space",
    entityId: spaceId,
    spaceId,
    after: { term: q, replacement, artigos, ocorrencias, rascunhos, erros },
  });
  return { ok: true, artigos, ocorrencias, rascunhos, erros };
}
