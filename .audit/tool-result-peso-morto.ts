/**
 * Quanto do resultado que vai ao MODELO é peso morto?
 *
 * Duas classes que não exigem nenhuma decisão de domínio, porque não perdem
 * informação nenhuma:
 *   CONSTANTE — o campo tem o mesmo valor em TODAS as linhas da resposta. Com 96
 *               linhas, ele é cobrado 96 vezes para dizer uma coisa só.
 *   NULO      — o campo é null/"" em todas as linhas. Não diz nada em lugar nenhum.
 *
 * Lê os previews de `ai_tool_runs` (truncados: corta no último `}` completo e
 * fecha o array). Estimativa, não censo — o suficiente para decidir se vale.
 */
import pg from "pg";
import { parseDbConfig } from "../src/lib/jobs/db-config";

const c = new pg.Client(parseDbConfig());
await c.connect();
await c.query("SET default_transaction_read_only = on");

const { rows } = await c.query(`
  select tool_key, output->>'preview' preview
  from ai_tool_runs
  where created_at > now() - interval '30 days' and ok and output ? 'preview'
  order by created_at desc limit 400`);

/** Recupera as linhas de um preview truncado. */
function itens(preview: string): Record<string, unknown>[] {
  const i = preview.indexOf('"items":[');
  if (i < 0) return [];
  const corpo = preview.slice(i + '"items":['.length);
  const fim = corpo.lastIndexOf("},");
  const texto = fim > 0 ? `[${corpo.slice(0, fim + 1)}]` : `[${corpo.replace(/,?\s*$/, "")}]`;
  try {
    const v = JSON.parse(texto) as unknown;
    return Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Record<string, unknown>[]) : [];
  } catch {
    return [];
  }
}

const porTool = new Map<string, { n: number; bytes: number; const_: number; nulo: number; campos: number; linhas: number }>();

for (const r of rows) {
  const linhas = itens(String(r.preview ?? ""));
  if (linhas.length < 2) continue;
  const chaves = [...new Set(linhas.flatMap((l) => Object.keys(l)))];
  let total = 0, constante = 0, nulo = 0;
  for (const k of chaves) {
    const vals = linhas.map((l) => l[k]);
    const custo = vals.reduce<number>((s, v) => s + JSON.stringify({ [k]: v ?? null }).length, 0);
    total += custo;
    const todosNulos = vals.every((v) => v === null || v === undefined || v === "");
    const primeiro = JSON.stringify(vals[0] ?? null);
    const todosIguais = vals.every((v) => JSON.stringify(v ?? null) === primeiro);
    if (todosNulos) nulo += custo;
    else if (todosIguais) constante += custo;
  }
  const a = porTool.get(r.tool_key) ?? { n: 0, bytes: 0, const_: 0, nulo: 0, campos: 0, linhas: 0 };
  a.n++; a.bytes += total; a.const_ += constante; a.nulo += nulo;
  a.campos += chaves.length; a.linhas += linhas.length;
  porTool.set(r.tool_key, a);
}

const lista = [...porTool.entries()].sort((a, b) => b[1].bytes - a[1].bytes).slice(0, 12);
let gTotal = 0, gConst = 0, gNulo = 0;
for (const [, a] of porTool) { gTotal += a.bytes; gConst += a.const_; gNulo += a.nulo; }

console.log(`respostas analisadas: ${[...porTool.values()].reduce((s, a) => s + a.n, 0)} de ${rows.length} previews\n`);
console.log("ferramenta".padEnd(44), "amostras".padStart(9), "campos".padStart(7), "linhas".padStart(7), "constante".padStart(10), "nulo".padStart(7), "morto".padStart(7));
for (const [k, a] of lista) {
  const morto = ((100 * (a.const_ + a.nulo)) / (a.bytes || 1)).toFixed(0);
  console.log(
    k.slice(0, 43).padEnd(44),
    String(a.n).padStart(9),
    (a.campos / a.n).toFixed(0).padStart(7),
    (a.linhas / a.n).toFixed(0).padStart(7),
    `${((100 * a.const_) / (a.bytes || 1)).toFixed(0)}%`.padStart(10),
    `${((100 * a.nulo) / (a.bytes || 1)).toFixed(0)}%`.padStart(7),
    `${morto}%`.padStart(7),
  );
}
console.log(`\nGERAL: constante ${((100 * gConst) / (gTotal || 1)).toFixed(1)}% · nulo ${((100 * gNulo) / (gTotal || 1)).toFixed(1)}% · PESO MORTO ${((100 * (gConst + gNulo)) / (gTotal || 1)).toFixed(1)}%`);

await c.end();
