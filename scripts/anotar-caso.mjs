/**
 * Grava a anotação humana num caso de `eval/cenarios.jsonl`, casando pela
 * PERGUNTA. Existe para a anotação acontecer em conversa e não editando JSONL
 * à mão — o formato é bom para máquina e péssimo para pessoa, e anotação que
 * dá trabalho não é feita.
 *
 *   node scripts/anotar-caso.mjs '<trecho da pergunta>' '<json com os campos>'
 */
import { readFileSync, writeFileSync } from "node:fs";
const [trecho, patchRaw] = process.argv.slice(2);
const ARQ = "eval/cenarios.jsonl";
const linhas = readFileSync(ARQ, "utf8").trim().split("\n").map((l) => JSON.parse(l));
const patch = JSON.parse(patchRaw);
// Casamento EXATO por padrão. `--contem` afrouxa, e só quando pedido: um
// "Pode" solto casou também com "Pode enviar" e anotou o caso errado — e
// anotação errada é pior que anotação faltando, porque vira gabarito.
const contem = process.argv.includes("--contem");
const igual = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
const alvos = linhas.filter((c) =>
  contem ? String(c.pergunta).toLowerCase().includes(trecho.toLowerCase()) : igual(String(c.pergunta), trecho),
);
if (alvos.length > 1 && !contem) {
  console.error(`"${trecho}" casou com ${alvos.length} casos — use um texto único.`);
  process.exit(1);
}
let n = 0;
for (const c of alvos) {
  Object.assign(c, patch);
  delete c.revisar; // anotado deixa de estar pendente
  n++;
  console.log(`✓ "${c.pergunta.slice(0, 56)}"`);
  console.log(`  ${JSON.stringify(patch)}`);
}
if (!n) { console.error(`Nenhum caso com "${trecho}".`); process.exit(1); }
writeFileSync(ARQ, linhas.map((c) => JSON.stringify(c)).join("\n") + "\n", "utf8");
const faltam = linhas.filter((c) => c.revisar).length;
console.log(`\n${linhas.length - faltam}/${linhas.length} anotados · faltam ${faltam}`);
