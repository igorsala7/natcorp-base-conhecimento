/**
 * O 2º sinal (trigram sobre o CONTEÚDO) custa 2,5 s dos 2,6 s da fusão.
 * ELE PAGA? Replica a fusão do `hybrid_search_scoped` em SQL puro (mesmo RRF,
 * mesmo k=60, mesmos 40 candidatos, mesmo agrupamento) e roda os casos do
 * gabarito COM e SEM esse sinal.
 *
 * SOMENTE LEITURA (SELECT). Braço léxico: sem vetor, para não gravar em `ai_usage`.
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx --env-file=.env.local .audit/rag-sinal-trigram.ts
 */
import ws from "ws";
if (!globalThis.WebSocket) {
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = ws;
}
import { readFileSync } from "node:fs";
import pg from "pg";
import { parseDbConfig } from "../src/lib/jobs/db-config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveTreePublic, type EffectiveNode } from "@/lib/content/overlays";
import { expandirConsulta } from "@/lib/ai/ontology";

type Caso = {
  tipo: string; pergunta: string; space_id: string;
  espera_nos?: string[] | null; espera_docs?: string[];
  descartado?: boolean;
};

const sb = createAdminClient();
const db = new pg.Client(parseDbConfig());

const ids = (l: EffectiveNode[], out: string[] = []): string[] => {
  for (const n of l) { if (n.hidden) continue; out.push(n.id); ids(n.children, out); }
  return out;
};

/** Fusão idêntica à do RPC. `comTrg` liga/desliga o trigram sobre CONTEÚDO. */
const FUSAO = (comTrg: boolean) => `
with q as (
  select public.f_unaccent($1) uq,
         websearch_to_tsquery('portuguese', public.f_unaccent($1)) tsq,
         case when $5::text is null or btrim($5) = '' then null
              else websearch_to_tsquery('portuguese', public.f_unaccent($5)) end bq
),
ft as (
  select id, origem, row_number() over (order by r desc) rnk from (
    select c.id, coalesce(c.node_id, c.document_id) origem, ts_rank(c.tsv, q.tsq) r
    from public.chunks c, q
    where q.tsq is not null and c.tsv @@ q.tsq
      and (c.node_id = any($2::uuid[]) or c.document_id = any($3::uuid[]))
    order by r desc limit 40) s
),
trg as (
  select id, origem, rnk from (
    select id, origem, row_number() over (order by sim desc) rnk from (
      select id, origem, max(sim) sim from (
        ${comTrg ? `
        ( select c.id, coalesce(c.node_id, c.document_id) origem,
                 similarity(public.f_unaccent(c.content), q.uq) sim
          from public.chunks c, q
          where public.f_unaccent(c.content) % q.uq
            and (c.node_id = any($2::uuid[]) or c.document_id = any($3::uuid[]))
          order by sim desc limit 40 )
        union all` : ``}
        ( select c.id, coalesce(c.node_id, c.document_id) origem,
                 similarity(public.f_unaccent(n.title), q.uq) sim
          from public.chunks c join public.nodes n on n.id = c.node_id, q
          where public.f_unaccent(n.title) % q.uq
            and (c.node_id = any($2::uuid[]) or c.document_id = any($3::uuid[]))
          order by sim desc limit 40 )
      ) u group by id, origem) g) r
  where rnk <= 40
),
boost as (
  select id, origem, row_number() over (order by r desc) rnk from (
    select c.id, coalesce(c.node_id, c.document_id) origem, ts_rank(c.tsv, q.bq) r
    from public.chunks c, q
    where q.bq is not null and c.tsv @@ q.bq
      and (c.node_id = any($2::uuid[]) or c.document_id = any($3::uuid[]))
    order by r desc limit 40) s
),
fused as (
  select origem, id, sum(1.0/(60+rnk)) score from (
    select origem, id, rnk from ft
    union all select origem, id, rnk from trg
    union all select origem, id, rnk from boost) u
  group by origem, id
),
best as (select distinct on (origem) origem, id chunk_id, score from fused order by origem, score desc),
agrupado as (
  select b.chunk_id, b.score, b.origem,
    case when c2.node_id is not null
      then 'raiz:' || coalesce(subpath(n2.path,0,1)::text, c2.node_id::text)
      else 'doc:' || c2.document_id::text end grupo
  from best b join public.chunks c2 on c2.id=b.chunk_id
  left join public.nodes n2 on n2.id=c2.node_id
),
melhores as (select grupo from agrupado group by grupo order by max(score) desc limit $6::int)
select a.origem, a.score from agrupado a join melhores m on m.grupo=a.grupo
order by a.score desc limit $4::int;
`;

async function main() {
  await db.connect();
  await db.query("SET default_transaction_read_only = on");
  const todos = readFileSync("eval/rag.jsonl", "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Caso);
  const casos = todos.filter((c) => !c.descartado && ((c.espera_nos ?? []).length > 0 || (c.espera_docs ?? []).length > 0));

  const cache = new Map<string, { nodes: string[]; docs: string[] }>();
  const acc = { com: { um: 0, j: 0, mrr: 0, ms: 0 }, sem: { um: 0, j: 0, mrr: 0, ms: 0 } };
  const linhas: string[] = [];

  for (const c of casos) {
    if (!cache.has(c.space_id)) {
      const tree = await getEffectiveTreePublic(c.space_id, sb as never);
      const { data: sp } = await sb.from("spaces").select("id, parent_space_id").eq("id", c.space_id);
      const sids = new Set<string>([c.space_id]);
      for (const s of sp ?? []) if (s.parent_space_id) sids.add(s.parent_space_id);
      const { data: docs } = await sb.from("knowledge_documents").select("id").in("space_id", [...sids]).eq("status", "ready");
      cache.set(c.space_id, { nodes: ids(tree), docs: (docs ?? []).map((d) => d.id) });
    }
    const { nodes, docs } = cache.get(c.space_id)!;
    const esperados = new Set([...(c.espera_nos ?? []), ...(c.espera_docs ?? [])]);
    const { lexica, boost } = await expandirConsulta(sb as never, [c.space_id], c.pergunta, null);
    const args = [lexica, nodes, docs, 8, boost, 2];

    const roda = async (comTrg: boolean) => {
      const t = Date.now();
      const r = await db.query(FUSAO(comTrg), args);
      return { pos: r.rows.findIndex((x: { origem: string }) => esperados.has(x.origem)), ms: Date.now() - t };
    };
    const com = await roda(true);
    const sem = await roda(false);
    for (const [k, v] of [["com", com], ["sem", sem]] as const) {
      const a = acc[k];
      if (v.pos === 0) a.um++;
      if (v.pos >= 0 && v.pos < 4) a.j++;
      if (v.pos >= 0) a.mrr += 1 / (v.pos + 1);
      a.ms += v.ms;
    }
    const m = (p: number) => (p < 0 ? "fora" : `${p + 1}º`);
    linhas.push(`${c.tipo.padEnd(9)} com=${m(com.pos).padEnd(5)} sem=${m(sem.pos).padEnd(5)} ${String(com.ms).padStart(5)}ms → ${String(sem.ms).padStart(4)}ms  ${c.pergunta.slice(0, 44)}`);
  }

  const n = casos.length;
  console.log(linhas.join("\n"));
  console.log(`\n${"fusão".padEnd(34)} top-1  top-4   MRR    ms/consulta`);
  for (const [k, rot] of [["com", "COM trigram de conteúdo (hoje)"], ["sem", "SEM trigram de conteúdo"]] as const) {
    const a = acc[k];
    console.log(`${rot.padEnd(34)} ${String(a.um).padStart(2)}/${n}  ${String(a.j).padStart(2)}/${n}   ${(a.mrr / n).toFixed(3)}  ${Math.round(a.ms / n)}ms`);
  }
  await db.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
