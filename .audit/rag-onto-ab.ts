/**
 * A/B da ONTOLOGIA sobre a recuperação — braço LÉXICO (ft + trigram + boost).
 *
 * SOMENTE LEITURA: não gera embedding (o wrapper de embedding do projeto GRAVA
 * em `ai_usage`), então roda com `p_embedding = null`. Isso é exatamente o modo
 * `lexicalOnly` da produção (modo relatório + RAG-para-tool), e isola as três
 * funções da ontologia que vivem no braço léxico: consulta expandida, boost
 * (4º sinal) e injeção forçada do nó "responsável".
 *
 * Braços:
 *   A  lexica + boost + forçada   (produção, sem vetor)
 *   B  pergunta crua, sem boost   (ontologia desligada)
 *   C  lexica + boost, sem forçada
 *   D  lexica sem boost           (isola o 4º sinal)
 *   E  = A com p_group_limit 4    (isola a regra anti-mistura)
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx --env-file=.env.local .audit/rag-onto-ab.ts
 */
import ws from "ws";
if (!globalThis.WebSocket) {
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = ws;
}
import { readFileSync } from "node:fs";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveTreePublic, type EffectiveNode } from "@/lib/content/overlays";
import { expandirConsulta } from "@/lib/ai/ontology";

type Caso = {
  tipo: string;
  pergunta: string;
  space_id: string;
  espera_nos?: string[] | null;
  espera_docs?: string[];
  descartado?: boolean;
  comportamento?: string;
};

const sb = createAdminClient();

const idsDaArvore = (list: EffectiveNode[], out: string[] = []): string[] => {
  for (const n of list) {
    if (n.hidden) continue;
    out.push(n.id);
    idsDaArvore(n.children, out);
  }
  return out;
};

async function docsDoEspaco(spaceId: string): Promise<string[]> {
  const { data: sp } = await sb.from("spaces").select("id, parent_space_id").eq("id", spaceId);
  const ids = new Set<string>([spaceId]);
  for (const s of sp ?? []) if (s.parent_space_id) ids.add(s.parent_space_id);
  const { data } = await sb
    .from("knowledge_documents")
    .select("id")
    .in("space_id", [...ids])
    .eq("status", "ready");
  return (data ?? []).map((d) => d.id);
}

async function buscar(
  q: string,
  nodeIds: string[],
  docIds: string[],
  boost: string | null,
  grupos: number,
  limit = 8,
): Promise<{ node_id: string | null; document_id: string | null; title: string; score: number }[]> {
  const { data, error } = await sb.rpc("hybrid_search_scoped", {
    p_query: q,
    p_node_ids: nodeIds.length ? nodeIds : undefined,
    p_document_ids: docIds.length ? docIds : undefined,
    p_limit: limit,
    p_boost: boost ?? undefined,
    p_group_limit: grupos,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as never;
}

/** Replica a injeção forçada do `rag.ts` (vínculo termo→artigo da ontologia). */
async function comForcada(
  base: Awaited<ReturnType<typeof buscar>>,
  responsaveis: string[],
  q: string,
  nodeIds: string[],
  boost: string | null,
  limit: number,
) {
  if (!responsaveis.length) return { lista: base, forcou: false };
  const artigos = new Set<string>();
  const subs = await Promise.all(responsaveis.map((nid) => sb.rpc("subtree_ids", { p_node_id: nid })));
  for (const { data: sub } of subs) for (const r of sub ?? []) if (r.type === "article") artigos.add(r.id);
  const escopo = new Set(nodeIds);
  const jaTem = new Set(base.map((r) => r.node_id).filter((x): x is string => !!x));
  const faltando = [...artigos].filter((id) => escopo.has(id) && !jaTem.has(id));
  if (!faltando.length) return { lista: base, forcou: false };
  const f = await buscar(q, faltando, [], boost, 2, 1);
  if (!f.length) return { lista: base, forcou: false };
  return { lista: [f[0]!, ...base].slice(0, limit), forcou: true };
}

const posicao = (lista: { node_id: string | null; document_id: string | null }[], esperados: Set<string>) =>
  lista.findIndex((f) => (f.node_id && esperados.has(f.node_id)) || (f.document_id && esperados.has(f.document_id)));

const marca = (p: number, janela = 4) => (p < 0 ? "fora" : `${p + 1}º${p < janela ? "" : "~"}`);

async function main() {
  const todos = readFileSync("eval/rag.jsonl", "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Caso);
  const casos = todos.filter((c) => !c.descartado && ((c.espera_nos ?? []).length > 0 || (c.espera_docs ?? []).length > 0));
  console.log(`${casos.length} casos pontuáveis · braço LÉXICO (sem vetor)\n`);

  const escopoCache = new Map<string, { nodes: string[]; docs: string[] }>();
  const linhas: string[] = [];
  const acc: Record<string, { j: number; um: number; mrr: number }> = {};
  const bump = (k: string, p: number) => {
    acc[k] ??= { j: 0, um: 0, mrr: 0 };
    if (p === 0) acc[k]!.um++;
    if (p >= 0 && p < 4) acc[k]!.j++;
    if (p >= 0) acc[k]!.mrr += 1 / (p + 1);
  };
  let expandiu = 0, mudouTopo = 0, mudouConjunto = 0, forcouN = 0;

  for (const c of casos) {
    if (!escopoCache.has(c.space_id)) {
      const tree = await getEffectiveTreePublic(c.space_id, sb as never);
      escopoCache.set(c.space_id, { nodes: idsDaArvore(tree), docs: await docsDoEspaco(c.space_id) });
    }
    const { nodes, docs } = escopoCache.get(c.space_id)!;
    const esperados = new Set([...(c.espera_nos ?? []), ...(c.espera_docs ?? [])]);
    const { lexica, boost, responsaveis } = await expandirConsulta(sb as never, [c.space_id], c.pergunta, null);
    const houveExpansao = lexica !== c.pergunta;
    if (houveExpansao) expandiu++;

    const semOnto = await buscar(c.pergunta, nodes, docs, null, 2);
    const semForcada = await buscar(lexica, nodes, docs, boost, 2);
    const semBoost = await buscar(lexica, nodes, docs, null, 2);
    const g4 = await buscar(lexica, nodes, docs, boost, 4);
    const { lista: comTudo, forcou } = await comForcada(semForcada, responsaveis, lexica, nodes, boost, 8);
    if (forcou) forcouN++;

    const pA = posicao(comTudo, esperados);
    const pB = posicao(semOnto, esperados);
    const pC = posicao(semForcada, esperados);
    const pD = posicao(semBoost, esperados);
    const pE = posicao(g4, esperados);
    bump("A", pA); bump("B", pB); bump("C", pC); bump("D", pD); bump("E", pE);

    const chave = (l: typeof comTudo) => l.map((r) => r.node_id ?? r.document_id).join(",");
    if (chave(comTudo) !== chave(semOnto)) mudouConjunto++;
    if ((comTudo[0]?.node_id ?? comTudo[0]?.document_id) !== (semOnto[0]?.node_id ?? semOnto[0]?.document_id)) mudouTopo++;

    linhas.push(
      `${c.tipo.padEnd(9)} ${(houveExpansao ? "ONT" : "  -").padEnd(4)} ` +
        `A=${marca(pA).padEnd(5)} B=${marca(pB).padEnd(5)} C=${marca(pC).padEnd(5)} ` +
        `D=${marca(pD).padEnd(5)} E4=${marca(pE).padEnd(5)} ${c.pergunta.slice(0, 46)}`,
    );
  }

  const n = casos.length;
  console.log(linhas.join("\n"));
  console.log(`\n${"braço".padEnd(28)} top-1   top-4   MRR`);
  const nome: Record<string, string> = {
    A: "A produção (lex+boost+forç)",
    B: "B SEM ontologia",
    C: "C sem injeção forçada",
    D: "D sem boost (4º sinal)",
    E: "E group_limit 4",
  };
  for (const k of ["A", "B", "C", "D", "E"]) {
    const a = acc[k]!;
    console.log(`${nome[k]!.padEnd(28)} ${String(a.um).padStart(2)}/${n}   ${String(a.j).padStart(2)}/${n}   ${(a.mrr / n).toFixed(3)}`);
  }
  console.log(`\nontologia expandiu a consulta em ${expandiu}/${n} casos`);
  console.log(`injeção forçada disparou em ${forcouN}/${n}`);
  console.log(`conjunto top-8 mudou (A vs B): ${mudouConjunto}/${n} · 1º lugar mudou: ${mudouTopo}/${n}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
