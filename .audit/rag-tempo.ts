/**
 * DECOMPOSIÇÃO DA LATÊNCIA DO RAG — onde vão os ~2,5 s medidos no trace.
 *
 * SOMENTE LEITURA: não gera embedding (o wrapper do projeto grava em `ai_usage`).
 * Mede as três etapas que existem antes e depois do embedding:
 *   1. escopo    getEffectiveTreePublic + spaces + knowledge_documents
 *   2. ontologia expandirConsulta (carrega termos+aliases; cache de 60 s em memória)
 *   3. fusão     RPC hybrid_search_scoped (léxico: ft + trigram + boost)
 *
 * Roda FRIO (1ª volta) e QUENTE (2ª volta) para separar o custo de cache frio.
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx --env-file=.env.local .audit/rag-tempo.ts
 */
import ws from "ws";
if (!globalThis.WebSocket) {
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = ws;
}
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveTreePublic, type EffectiveNode } from "@/lib/content/overlays";
import { expandirConsulta } from "@/lib/ai/ontology";

const sb = createAdminClient();
const ESPACO = process.env.ESPACO ?? "a5e69064-8584-4327-9116-726b717ea604"; // natcorp
const PERGUNTAS = [
  "como faço requisição de férias",
  "onde vejo meu holerite",
  "parametrização de jornada intrajornada",
  "quantos colaboradores tem a empresa",
  "banco de horas negativo",
];

const ids = (list: EffectiveNode[], out: string[] = []): string[] => {
  for (const n of list) {
    if (n.hidden) continue;
    out.push(n.id);
    ids(n.children, out);
  }
  return out;
};

const ms = async <T,>(f: () => Promise<T>): Promise<[T, number]> => {
  const t = Date.now();
  const r = await f();
  return [r, Date.now() - t];
};

async function volta(rotulo: string) {
  const acc = { escopo: 0, onto: 0, rpc: 0 };
  let nNodes = 0, nDocs = 0;
  for (const q of PERGUNTAS) {
    const [escopo, tEsc] = await ms(async () => {
      const tree = await getEffectiveTreePublic(ESPACO, sb as never);
      const nodes = ids(tree);
      const { data: sp } = await sb.from("spaces").select("id, parent_space_id").eq("id", ESPACO);
      const spaceIds = new Set<string>([ESPACO]);
      for (const s of sp ?? []) if (s.parent_space_id) spaceIds.add(s.parent_space_id);
      const { data: docs } = await sb.from("knowledge_documents").select("id").in("space_id", [...spaceIds]).eq("status", "ready");
      return { nodes, docs: (docs ?? []).map((d) => d.id) };
    });
    nNodes = escopo.nodes.length;
    nDocs = escopo.docs.length;
    const [exp, tOnt] = await ms(() => expandirConsulta(sb as never, [ESPACO], q, null));
    const [, tRpc] = await ms(() =>
      sb.rpc("hybrid_search_scoped", {
        p_query: exp.lexica,
        p_node_ids: escopo.nodes,
        p_document_ids: escopo.docs,
        p_limit: 8,
        p_boost: exp.boost ?? undefined,
        p_group_limit: 2,
      }),
    );
    acc.escopo += tEsc;
    acc.onto += tOnt;
    acc.rpc += tRpc;
  }
  const n = PERGUNTAS.length;
  console.log(
    `${rotulo.padEnd(8)} escopo=${Math.round(acc.escopo / n)}ms  ontologia=${Math.round(acc.onto / n)}ms  ` +
      `RPC=${Math.round(acc.rpc / n)}ms  TOTAL=${Math.round((acc.escopo + acc.onto + acc.rpc) / n)}ms  ` +
      `(escopo: ${nNodes} nós, ${nDocs} arquivos)`,
  );
}

await volta("frio");
await volta("quente");
