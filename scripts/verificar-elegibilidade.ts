/**
 * PARIDADE ENTRE AS DUAS IMPLEMENTAÇÕES DA ELEGIBILIDADE.
 *
 * A regra vive em TypeScript (a tela mostra a frase ao vivo) e em SQL (o corte
 * acontece no banco, porque widget.js é público). Isso é necessário e é uma
 * dívida: no dia em que alguém corrigir o `btrim` só de um lado, a tela promete
 * um alcance que o banco não entrega, e ninguém vê erro.
 *
 * Este script roda o MESMO corpus nos dois e sai com código 1 na primeira
 * divergência. Rodar antes de cada deploy que toque elegibilidade.
 */
import { readFileSync } from "node:fs";
import pg from "pg";
// Relativo, sem extensão, como `.audit/sql.ts` já faz: o alias `@/` do
// tsconfig não é resolvido por scripts rodados fora do Next.
import { parseDbConfig } from "../src/lib/jobs/db-config";
import { alcanca } from "../src/lib/elegibilidade/alcanca";
import { DIMENSOES } from "../src/lib/elegibilidade/dimensoes";

const corpus = JSON.parse(readFileSync("src/lib/elegibilidade/casos.json", "utf8"));
const client = new pg.Client(parseDbConfig());
await client.connect();
await client.query("SET default_transaction_read_only = on");

/**
 * PRIMEIRO as duas LISTAS, depois os casos.
 *
 * Comparar só o comportamento em casos escritos não pega a divergência que mais
 * importa: alguém acrescentar uma dimensão de um lado só. O script não descobre
 * dimensão nova sozinho a partir dos casos, então ele pergunta ao banco qual é a
 * lista e compara com a do TypeScript.
 */
const { rows: dimRows } = await client.query("select public.dimensoes_elegibilidade() as d");
const doBanco: string[] = dimRows[0].d;
if (doBanco.join("|") !== DIMENSOES.join("|")) {
  console.error("As DUAS LISTAS de dimensões divergem, e nenhum caso de teste pegaria isso:");
  console.error(`  banco:      ${doBanco.join(", ")}`);
  console.error(`  typescript: ${DIMENSOES.join(", ")}`);
  await client.end();
  process.exit(1);
}

let divergencias = 0;
for (const c of corpus.casos) {
  const ts = alcanca(c.regra, c.identidade);
  const { rows } = await client.query("select public.elegivel($1::jsonb, $2::jsonb) as r", [
    JSON.stringify(c.regra),
    JSON.stringify(c.identidade),
  ]);
  const sql = rows[0].r;
  if (ts !== sql || ts !== c.esperado) {
    divergencias++;
    console.error(
      `DIVERGIU  ${c.nome}\n  esperado=${c.esperado}  typescript=${ts}  sql=${sql}`,
    );
  }
}
await client.end();

if (divergencias) {
  console.error(`\n${divergencias} divergência(s) de ${corpus.casos.length} casos.`);
  process.exit(1);
}
console.log(
  `Elegibilidade em paridade: as doze dimensões batem e ${corpus.casos.length} casos concordam entre SQL e TypeScript.`,
);
