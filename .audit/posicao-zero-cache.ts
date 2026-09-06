/**
 * Quanto vale estabilizar a POSIÇÃO 0 (o bloco de ferramentas)?
 *
 * Refaz `.audit/tools-cache.mjs` e `.audit/prefixo.mjs`, que não rodam mais:
 * os dois montam o `pg.Client` com `connectionString`, e a senha do banco tem
 * `@`/`#` — `new URL` quebra. Usa o `parseDbConfig` do projeto, como o sql.ts.
 *
 * Responde três coisas que decidem o desenho:
 *   1. identidade do bloco entre turnos consecutivos (o 5,8% de 24/08)
 *   2. quantas ferramentas por turno, e quantas o catálogo inteiro tem
 *   3. quantos turnos tem uma conversa — o denominador do break-even do cache
 */
import pg from "pg";
import { parseDbConfig } from "../src/lib/jobs/db-config";

const c = new pg.Client(parseDbConfig());
await c.connect();
await c.query("SET default_transaction_read_only = on");

const { rows } = await c.query(`
  select t.conversation_id, t.created_at, t.base_code,
         (select p->'info'->'tools' from jsonb_array_elements(t.passos) p where p->>'passo'='ferramentas' limit 1) tools,
         (select (p->'info'->>'systemTok')::int from jsonb_array_elements(t.passos) p where p->>'passo'='prompt_blocks' limit 1) system_tok
  from ai_chat_traces t
  where t.created_at > now() - interval '20 days' and t.conversation_id is not null
  order by t.conversation_id, t.created_at`);

type Turno = { conv: string; t: Date; tools: string[]; systemTok: number | null };
const turnos: Turno[] = rows
  .filter((r) => Array.isArray(r.tools))
  .map((r) => ({ conv: r.conversation_id, t: new Date(r.created_at), tools: r.tools as string[], systemTok: r.system_tok }));

const porConv = new Map<string, Turno[]>();
for (const x of turnos) {
  if (!porConv.has(x.conv)) porConv.set(x.conv, []);
  porConv.get(x.conv)!.push(x);
}

let pares = 0, igualConjunto = 0, igualBytes = 0, somaPrefixo = 0, somaTools = 0;
let paresTTL = 0, igualTTL = 0;
const quebra = new Map<string, number>();
for (const ts of porConv.values()) {
  for (let i = 1; i < ts.length; i++) {
    const a = ts[i - 1]!.tools, b = ts[i]!.tools;
    pares++;
    if (JSON.stringify([...a].sort()) === JSON.stringify([...b].sort())) igualConjunto++;
    if (JSON.stringify(a) === JSON.stringify(b)) igualBytes++;
    let k = 0; while (k < a.length && k < b.length && a[k] === b[k]) k++;
    somaPrefixo += k; somaTools += b.length;
    if (k < b.length) quebra.set(b[k]!, (quebra.get(b[k]!) ?? 0) + 1);
    // dentro do TTL de 5 min do cache do provedor
    if (ts[i]!.t.getTime() - ts[i - 1]!.t.getTime() <= 300_000) {
      paresTTL++;
      if (JSON.stringify(a) === JSON.stringify(b)) igualTTL++;
    }
  }
}

const tamanhos = [...porConv.values()].map((x) => x.length).sort((a, b) => a - b);
const pct = (v: number, n: number) => `${((100 * v) / (n || 1)).toFixed(1)}%`;
const perc = (p: number) => tamanhos[Math.min(tamanhos.length - 1, Math.floor(p * tamanhos.length))] ?? 0;

console.log(`turnos com bloco de ferramentas: ${turnos.length} em ${porConv.size} conversas`);
console.log(`ferramentas por turno: média ${(somaTools / (pares || 1)).toFixed(1)}`);
console.log(`\n── IDENTIDADE DO BLOCO ENTRE TURNOS CONSECUTIVOS ──`);
console.log(`pares                       ${pares}`);
console.log(`  mesmo CONJUNTO            ${igualConjunto}  ${pct(igualConjunto, pares)}`);
console.log(`  mesmos BYTES (com ordem)  ${igualBytes}  ${pct(igualBytes, pares)}   ← é isto que o cache vê`);
console.log(`  prefixo idêntico médio    ${(somaPrefixo / (pares || 1)).toFixed(1)} de ${(somaTools / (pares || 1)).toFixed(1)} = ${pct(somaPrefixo, somaTools)}`);
console.log(`pares dentro do TTL de 5min ${paresTTL}, iguais: ${igualTTL} (${pct(igualTTL, paresTTL)})`);

console.log(`\n── TAMANHO DA CONVERSA (o denominador do break-even) ──`);
console.log(`conversas: ${tamanhos.length} · p50 ${perc(0.5)} · p90 ${perc(0.9)} · p99 ${perc(0.99)} · máx ${tamanhos.at(-1)}`);
console.log(`turnos por conversa, média ${(turnos.length / porConv.size).toFixed(2)}`);

console.log(`\n── QUEM QUEBRA O PREFIXO (1ª ferramenta divergente) ──`);
[...quebra.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
  .forEach(([k, v]) => console.log(`${String(v).padStart(4)}  ${k}`));

const { rows: cat } = await c.query(`
  select b.base_code, count(*) filter (where t.active) ativas
  from ai_base_tools bt join ai_tools t on t.id = bt.tool_id join ai_bases b on b.id = bt.base_id
  group by 1 order by 2 desc limit 6`);
console.log(`\n── CATÁLOGO POR BASE (o tamanho do bloco se ele for estabilizado no CLIENTE) ──`);
for (const r of cat) console.log(`${String(r.ativas).padStart(4)}  ${r.base_code}`);

await c.end();
