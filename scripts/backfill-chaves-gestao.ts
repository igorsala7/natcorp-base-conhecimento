/**
 * Emite a chave da área de gestão para TODAS as bases que ainda não têm.
 *
 *   npm run gestao:chave:todas            (dev, lê .env.local)
 *   npm run gestao:chave:todas:prod       (produção, lê .env)
 *   npm run gestao:chave:todas -- --seco  (só diz o que faria)
 *
 * ── Por que existe ──────────────────────────────────────────────────────────
 * A partir de agora a chave nasce junto com o cadastro (`createBase`), e a tela
 * emite sozinha ao abrir a seção do APEX. Este script é o que fecha o passado:
 * as bases cadastradas ANTES disso ficariam esperando alguém abrir a aba delas.
 *
 * Rodar mais de uma vez é inofensivo: `garantirChaveDaBase` sem `forcar` NUNCA
 * sobrescreve — devolve a chave que existe. Nenhuma base em produção tem a
 * área de gestão derrubada por um backfill repetido, que é o defeito clássico
 * deste tipo de script.
 *
 * NÃO imprime chave nenhuma. Quem precisa do valor abre a base no admin; aqui
 * o que interessa é quantas faltavam.
 */
import { createAdminClient } from "../src/lib/supabase/admin";
import { garantirChaveDaBase, ehFalha, ESPACO_GESTAO } from "../src/lib/tracking/chave-base";

if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === "undefined") {
  const { WebSocket } = await import("ws");
  (globalThis as { WebSocket?: unknown }).WebSocket = WebSocket;
}

const SECO = process.argv.includes("--seco");

const db = createAdminClient();

const { data: espaco } = await db.from("spaces").select("id, name").eq("slug", ESPACO_GESTAO).maybeSingle();
if (!espaco) {
  console.error(`Espaço "${ESPACO_GESTAO}" não encontrado. A área de gestão vive nele.`);
  process.exit(1);
}

const { data: bases } = await db.from("ai_bases").select("id, base_code, name, active").order("base_code");
if (!bases?.length) {
  console.log("Nenhuma base em `ai_bases`.");
  process.exit(0);
}

const { data: comChave } = await db
  .from("ai_base_tracking_keys")
  .select("base_id")
  .eq("space_id", espaco.id);
const jaTem = new Set((comChave ?? []).map((r) => r.base_id));

const faltando = bases.filter((b) => !jaTem.has(b.id));

console.log("");
console.log(`  Espaço ........ ${ESPACO_GESTAO} (${espaco.name})`);
console.log(`  Bases ......... ${bases.length}`);
console.log(`  Já com chave .. ${bases.length - faltando.length}`);
console.log(`  Faltando ...... ${faltando.length}`);
console.log("");

if (!faltando.length) {
  console.log("  Nada a fazer.");
  process.exit(0);
}

if (SECO) {
  for (const b of faltando) {
    console.log(`  [seco] emitiria para ${b.base_code}${b.active ? "" : "  [INATIVA]"}  — ${b.name}`);
  }
  console.log("");
  console.log("  Rode sem --seco para gravar.");
  process.exit(0);
}

let ok = 0;
const falhas: string[] = [];
for (const b of faltando) {
  const r = await garantirChaveDaBase({ baseId: b.id });
  if (ehFalha(r)) {
    falhas.push(`${b.base_code}: ${r.erro}`);
    continue;
  }
  ok++;
  console.log(`  ✓ ${b.base_code}${b.active ? "" : "  [INATIVA]"}`);
}

console.log("");
console.log(`  Emitidas: ${ok} de ${faltando.length}`);
if (falhas.length) {
  console.log("");
  console.log("  FALHAS:");
  for (const f of falhas) console.log(`    ${f}`);
  process.exit(1);
}
