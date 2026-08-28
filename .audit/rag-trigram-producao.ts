/**
 * O trigram sobre CONTEÚDO muda o resultado em PERGUNTAS REAIS?
 * O gabarito tem 20 casos — pouco para concluir. Aqui a amostra são as perguntas
 * de verdade dos traces (não há gabarito, então a métrica é ESTABILIDADE: em que
 * fração das perguntas o top-4 muda quando o sinal sai).
 *
 * SOMENTE LEITURA (SELECT). Braço léxico (sem vetor).
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx --env-file=.env.local .audit/rag-trigram-producao.ts [N]
 */
import ws from "ws";
if (!globalThis.WebSocket) {
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = ws;
}
import pg from "pg";
import { parseDbConfig } from "../src/lib/jobs/db-config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveTreePublic, type EffectiveNode } from "@/lib/content/overlays";
import { expandirConsulta } from "@/lib/ai/ontology";

const N = Number(process.argv[2] ?? 120);
const sb = createAdminClient();
const db = new pg.Client(parseDbConfig());
const ids = (l: EffectiveNode[], out: string[] = []): string[] => {
  for (const n of l) { if (n.hidden) continue; out.push(n.id); ids(n.children, out); }
  return out;
};

const FUSAO = (comTrg: boolean) => `
with q as (select public.f_unaccent($1) uq, websearch_to_tsquery('portuguese', public.f_unaccent($1)) tsq,
  case when $4::text is null or btrim($4)='' then null else websearch_to_tsquery('portuguese', public.f_unaccent($4)) end bq),
ft as (select id, origem, row_number() over (order by r desc) rnk from (
  select c.id, coalesce(c.node_id,c.document_id) origem, ts_rank(c.tsv,q.tsq) r from public.chunks c, q
  where q.tsq is not null and c.tsv @@ q.tsq and (c.node_id = any($2::uuid[]) or c.document_id = any($3::uuid[]))
  order by r desc limit 40) s),
trg as (select id, origem, rnk from (select id, origem, row_number() over (order by sim desc) rnk from (
  select id, origem, max(sim) sim from (
    ${comTrg ? `( select c.id, coalesce(c.node_id,c.document_id) origem, similarity(public.f_unaccent(c.content), q.uq) sim
      from public.chunks c, q where public.f_unaccent(c.content) % q.uq
        and (c.node_id = any($2::uuid[]) or c.document_id = any($3::uuid[])) order by sim desc limit 40) union all` : ``}
    ( select c.id, coalesce(c.node_id,c.document_id) origem, similarity(public.f_unaccent(n.title), q.uq) sim
      from public.chunks c join public.nodes n on n.id=c.node_id, q where public.f_unaccent(n.title) % q.uq
        and (c.node_id = any($2::uuid[]) or c.document_id = any($3::uuid[])) order by sim desc limit 40)
  ) u group by id, origem) g) r where rnk <= 40),
boost as (select id, origem, row_number() over (order by r desc) rnk from (
  select c.id, coalesce(c.node_id,c.document_id) origem, ts_rank(c.tsv,q.bq) r from public.chunks c, q
  where q.bq is not null and c.tsv @@ q.bq and (c.node_id = any($2::uuid[]) or c.document_id = any($3::uuid[]))
  order by r desc limit 40) s),
fused as (select origem, id, sum(1.0/(60+rnk)) score from (
  select origem,id,rnk from ft union all select origem,id,rnk from trg union all select origem,id,rnk from boost) u
  group by origem, id),
best as (select distinct on (origem) origem, id chunk_id, score from fused order by origem, score desc),
agrupado as (select b.chunk_id, b.score, b.origem,
  case when c2.node_id is not null then 'raiz:' || coalesce(subpath(n2.path,0,1)::text, c2.node_id::text)
       else 'doc:' || c2.document_id::text end grupo
  from best b join public.chunks c2 on c2.id=b.chunk_id left join public.nodes n2 on n2.id=c2.node_id),
melhores as (select grupo from agrupado group by grupo order by max(score) desc limit 2)
select a.origem from agrupado a join melhores m on m.grupo=a.grupo order by a.score desc limit 4;`;

async function main() {
  await db.connect();
  await db.query("SET default_transaction_read_only = on");
  const { rows: perguntas } = await db.query(
    `select pergunta, space_id from ai_chat_traces
     where length(coalesce(pergunta,'')) between 8 and 200 and space_id is not null
       and coalesce(((select p->'info' from jsonb_array_elements(passos) p where p->>'passo'='rag' limit 1)->>'fontes')::int,0) > 0
     order by md5(id::text) limit $1`, [N]);

  const cache = new Map<string, { nodes: string[]; docs: string[] }>();
  let iguais = 0, mesmoTopo = 0, msCom = 0, msSem = 0, vazioCom = 0, vazioSem = 0;
  for (const p of perguntas) {
    if (!cache.has(p.space_id)) {
      const tree = await getEffectiveTreePublic(p.space_id, sb as never);
      const { data: sp } = await sb.from("spaces").select("id, parent_space_id").eq("id", p.space_id);
      const sids = new Set<string>([p.space_id]);
      for (const s of sp ?? []) if (s.parent_space_id) sids.add(s.parent_space_id);
      const { data: docs } = await sb.from("knowledge_documents").select("id").in("space_id", [...sids]).eq("status", "ready");
      cache.set(p.space_id, { nodes: ids(tree), docs: (docs ?? []).map((d) => d.id) });
    }
    const { nodes, docs } = cache.get(p.space_id)!;
    const { lexica, boost } = await expandirConsulta(sb as never, [p.space_id], p.pergunta, null);
    const args = [lexica, nodes, docs, boost];
    let t = Date.now();
    const a = (await db.query(FUSAO(true), args)).rows.map((r: { origem: string }) => r.origem);
    msCom += Date.now() - t;
    t = Date.now();
    const b = (await db.query(FUSAO(false), args)).rows.map((r: { origem: string }) => r.origem);
    msSem += Date.now() - t;
    if (a.join(",") === b.join(",")) iguais++;
    if (a[0] === b[0]) mesmoTopo++;
    if (!a.length) vazioCom++;
    if (!b.length) vazioSem++;
  }
  const n = perguntas.length;
  console.log(`\n${n} perguntas REAIS · braço léxico · top-4`);
  console.log(`top-4 IDÊNTICO sem o trigram de conteúdo: ${iguais}/${n} (${((100 * iguais) / n).toFixed(1)}%)`);
  console.log(`1º lugar idêntico ...................... ${mesmoTopo}/${n} (${((100 * mesmoTopo) / n).toFixed(1)}%)`);
  console.log(`vazio: com=${vazioCom} sem=${vazioSem}`);
  console.log(`ms/consulta: com=${Math.round(msCom / n)}  sem=${Math.round(msSem / n)}`);
  await db.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
