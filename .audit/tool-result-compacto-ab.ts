/**
 * ANTES/DEPOIS da compactação da amostra, sobre resultado REAL.
 *
 * Roda `compactarLinhas` nos previews gravados em `ai_tool_runs` e mede duas
 * coisas: quantos bytes por linha somem, e quantas linhas passam a caber no
 * orçamento de 60 mil caracteres — que é o número que decide truncamento.
 *
 * RESSALVA QUE NÃO PODE SUMIR DO RELATO: o preview guarda só as primeiras
 * linhas. "Constante em todas as linhas" medido sobre 3 linhas superestima a
 * constância que existiria sobre 96. Em produção o cálculo roda sobre a lista
 * INTEIRA, então o ganho real é MENOR do que o daqui — nunca maior, e nunca
 * incorreto: campo que varia na resposta cheia simplesmente não é fatorado.
 */
import pg from "pg";
import { parseDbConfig } from "../src/lib/jobs/db-config";
import { compactarLinhas } from "../src/lib/chat/compactar-linhas";
import { linhasQueCabem } from "../src/lib/chat/datasets";

const c = new pg.Client(parseDbConfig());
await c.connect();
await c.query("SET default_transaction_read_only = on");

const { rows } = await c.query(`
  select tool_key, output->>'preview' preview, (output->>'bytes')::bigint bytes_reais
  from ai_tool_runs
  where created_at > now() - interval '30 days' and ok and output ? 'preview'
  order by created_at desc limit 600`);

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

const bytes = (x: unknown) => { try { return JSON.stringify(x).length; } catch { return 0; } };

type Agg = { n: number; antes: number; depois: number; cabemAntes: number; cabemDepois: number; semGanho: number };
const porTool = new Map<string, Agg>();
let gAntes = 0, gDepois = 0, gCabemA = 0, gCabemD = 0, gN = 0, gSemGanho = 0;

for (const r of rows) {
  const linhas = itens(String(r.preview ?? ""));
  if (linhas.length < 3) continue;
  const comp = compactarLinhas(linhas);
  const porLinhaAntes = bytes(linhas) / linhas.length;
  const porLinhaDepois = comp ? (bytes(comp.linhas) + bytes(comp.comum) + bytes(comp.vazios)) / linhas.length : porLinhaAntes;
  // Quantas linhas desse formato cabem em 60 mil caracteres, repetindo a amostra
  // até o teto de 50 (é o mesmo cálculo de `linhasQueCabem`, com o mesmo teto).
  const encher = (base: Record<string, unknown>[]) => {
    const muitas: unknown[] = [];
    while (muitas.length < 50) muitas.push(...base);
    return linhasQueCabem(muitas.slice(0, 50));
  };
  const cabemAntes = encher(linhas);
  const cabemDepois = comp ? encher(comp.linhas) : cabemAntes;

  const a = porTool.get(r.tool_key) ?? { n: 0, antes: 0, depois: 0, cabemAntes: 0, cabemDepois: 0, semGanho: 0 };
  a.n++; a.antes += porLinhaAntes; a.depois += porLinhaDepois;
  a.cabemAntes += cabemAntes; a.cabemDepois += cabemDepois;
  if (!comp) a.semGanho++;
  porTool.set(r.tool_key, a);
  gN++; gAntes += porLinhaAntes; gDepois += porLinhaDepois; gCabemA += cabemAntes; gCabemD += cabemDepois;
  if (!comp) gSemGanho++;
}

const lista = [...porTool.entries()].sort((a, b) => b[1].antes - a[1].antes).slice(0, 10);
console.log(`respostas com 3+ linhas no preview: ${gN} de ${rows.length}\n`);
console.log("ferramenta".padEnd(44), "n".padStart(4), "b/linha antes".padStart(14), "depois".padStart(8), "corte".padStart(7), "cabem".padStart(12), "inerte".padStart(7));
for (const [k, a] of lista) {
  const corte = (100 * (1 - a.depois / (a.antes || 1))).toFixed(0);
  console.log(
    k.slice(0, 43).padEnd(44),
    String(a.n).padStart(4),
    (a.antes / a.n).toFixed(0).padStart(14),
    (a.depois / a.n).toFixed(0).padStart(8),
    `${corte}%`.padStart(7),
    `${(a.cabemAntes / a.n).toFixed(1)}→${(a.cabemDepois / a.n).toFixed(1)}`.padStart(12),
    String(a.semGanho).padStart(7),
  );
}
console.log(`\nGERAL  bytes/linha ${(gAntes / gN).toFixed(0)} → ${(gDepois / gN).toFixed(0)}  (−${(100 * (1 - gDepois / gAntes)).toFixed(1)}%)`);
console.log(`       linhas que cabem em 60k: ${(gCabemA / gN).toFixed(1)} → ${(gCabemD / gN).toFixed(1)}  (+${(100 * (gCabemD / gCabemA - 1)).toFixed(1)}%)`);
console.log(`       respostas em que a compactação NÃO agiu: ${gSemGanho} (${((100 * gSemGanho) / gN).toFixed(1)}%)`);

await c.end();
