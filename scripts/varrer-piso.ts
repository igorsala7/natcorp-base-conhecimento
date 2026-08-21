/**
 * QUANTO O PISO RELATIVO CUSTA EM ACERTO, E O QUE CUSTARIA AFROUXÁ-LO.
 *
 * O funil não corta por posição: corta por DISTÂNCIA até a melhor ferramenta do
 * turno (`MARGEM_SEM`, hoje 0,08). Por isso o placar reprova ferramentas que
 * ficaram em 5º e 6º de 88 — estavam no top-12 e mesmo assim fora da banda.
 *
 * Este script mede, sobre o gabarito e sem chamar modelo nenhum, a distância de
 * cada ferramenta ESPERADA até o topo do seu turno. Com isso dá para responder
 * a pergunta que importa antes de mexer na constante: quantos acertos uma
 * margem maior compra, e quantas ferramentas a mais ela despeja no prompt.
 *
 * Mexer no piso sem esta conta é o erro que originou toda esta linha de
 * trabalho — e o piso é a peça mais sensível do funil, porque afrouxá-lo não
 * "adiciona a certa": adiciona a cauda inteira daquele turno.
 *
 *   npx tsx --env-file=.env.local scripts/varrer-piso.ts
 */
import ws from "ws";
if (!globalThis.WebSocket) {
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = ws;
}
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import type { Database } from "../src/lib/database.types";
import { simTools, listBaseTools } from "../src/lib/integrations/tool-catalog";

const BASE = "natcorp";
const MARGENS = [0.06, 0.08, 0.1, 0.12, 0.16, 0.2];

type Caso = { pergunta: string; espera_tool: string | null; revisar?: boolean; ofertadas?: string[] };

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error("Faltam credenciais."); process.exit(1); }
  const db = createClient<Database>(url, key, { auth: { persistSession: false } });

  const casos = (readFileSync("eval/cenarios.jsonl", "utf8").trim().split("\n").filter(Boolean)
    .map((l) => JSON.parse(l) as Caso))
    .filter((c) => !c.revisar && c.espera_tool);

  const doBase = await listBaseTools(db as never, BASE);
  const habilitadas = new Set(doBase.map((t) => t.key));
  // Só ferramenta de INTEGRAÇÃO: local não passa por similaridade nenhuma.
  const medíveis = casos.filter((c) => habilitadas.has(c.espera_tool!));
  console.log(`\n  ${casos.length} casos com ferramenta esperada · ${medíveis.length} de integração\n`);

  type Linha = { pergunta: string; tool: string; topo: number; sim: number; dist: number; pos: number };
  const linhas: Linha[] = [];
  for (const c of medíveis) {
    const sim = await simTools(db as never, BASE, c.pergunta);
    if (!sim || !sim.size) continue;
    const vals = [...sim.values()].sort((a, b) => b - a);
    const topo = vals[0] ?? 0;
    const s = sim.get(c.espera_tool!) ?? 0;
    const pos = vals.findIndex((v) => v <= s) + 1;
    linhas.push({ pergunta: c.pergunta, tool: c.espera_tool!, topo, sim: s, dist: topo - s, pos });
  }

  const dentro = (l: Linha, m: number) => l.dist <= m;
  console.log("  margem   esperadas DENTRO da banda   ferramentas por turno (mediana)");
  for (const m of MARGENS) {
    const ok = linhas.filter((l) => dentro(l, m)).length;
    // Quantas ferramentas do catálogo entrariam na banda, por turno.
    const quantidades: number[] = [];
    for (const c of medíveis) {
      const sim = await simTools(db as never, BASE, c.pergunta);
      if (!sim?.size) continue;
      const vals = [...sim.values()];
      const topo = Math.max(...vals);
      quantidades.push(vals.filter((v) => topo - v <= m).length);
    }
    quantidades.sort((a, b) => a - b);
    const mediana = quantidades[Math.floor(quantidades.length / 2)] ?? 0;
    const marca = m === 0.08 ? "  ← hoje" : "";
    console.log(`   ${m.toFixed(2)}     ${String(ok).padStart(3)}/${linhas.length}  (${((ok / linhas.length) * 100).toFixed(0)}%)          ${String(mediana).padStart(3)}${marca}`);
  }

  console.log("\n  as que ficam FORA da banda de hoje (0,08), por distância:");
  for (const l of linhas.filter((x) => x.dist > 0.08).sort((a, b) => a.dist - b.dist)) {
    console.log(`    dist ${l.dist.toFixed(3)}  (topo ${l.topo.toFixed(3)} · ela ${l.sim.toFixed(3)} · ${l.pos}º)  ${l.tool.padEnd(38)} "${l.pergunta.slice(0, 30)}"`);
  }
  console.log("");
}

main().catch((e) => { console.error(e); process.exit(1); });
