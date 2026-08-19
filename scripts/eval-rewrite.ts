/**
 * A REESCRITA AJUDA OU ATRAPALHA A SELEÇÃO DE FERRAMENTAS? — read-only.
 *
 * `interpretarConsulta` reescreve a pergunta antes do RAG e da seleção. A
 * intenção é boa: "quanto ganho" vira "remuneração", e o índice acha. Mas a
 * mesma reescrita alimenta o roteador, e medindo 14 dias de uso real
 * (19/08/2026) ela MUDOU a pergunta em 96% dos turnos e a substituiu por
 * completo em 34% — quase sempre pelo TÍTULO DA TELA:
 *
 *   "Mas eu quero no geral"                → "Linha do tempo dos funcionários"
 *   "Fiquei decepcionado com seu resultado" → "Gerador de Relatórios"
 *
 * Este script responde a pergunta que decide o que fazer com isso: rodando as
 * DUAS versões pelo mesmo caminho semântico do chat, qual delas traz a
 * ferramenta certa mais vezes?
 *
 * ── O gabarito, e o que ele vale ────────────────────────────────────────────
 * A ferramenta que o agente REALMENTE chamou e que devolveu dados. Não é
 * verdade absoluta — ele pode ter chamado a errada e ninguém corrigido. Mas é
 * o único rótulo disponível em escala, e serve para COMPARAR duas consultas
 * sobre o mesmo caso: o viés, seja qual for, é idêntico para as duas.
 *
 * Onde as duas discordam, o caso é impresso para leitura humana. Número que
 * ninguém consegue conferir não decide nada.
 *
 *   npm run eval:rewrite
 *   npm run eval:rewrite -- --dias 30 --base natcorp
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";
import { simTools } from "../src/lib/integrations/tool-catalog";
import { selecionarTopK } from "../src/lib/integrations/tool-narrow";

if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === "undefined") {
  const { WebSocket } = await import("ws");
  (globalThis as { WebSocket?: unknown }).WebSocket = WebSocket;
}

const arg = (nome: string, padrao: string): string => {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : padrao;
};
const DIAS = Number(arg("dias", "14"));
const BASE = arg("base", "natcorp");
const TOP = Number(arg("top", "12"));
const MAX = Number(arg("max", "120"));

type PassoTrace = { passo: string; info?: Record<string, unknown> | null };

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) {
    console.error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }
  const db = createClient<Database>(url, chave, { auth: { persistSession: false } });

  const { data: base } = await db.from("ai_bases").select("id").eq("base_code", BASE).maybeSingle();
  if (!base) {
    console.error(`Base "${BASE}" não encontrada.`);
    process.exit(1);
  }
  const { data: vinculos } = await db
    .from("ai_base_tools")
    .select("tool:ai_tools(key, name, description, search_terms, always_include, active)")
    .eq("base_id", base.id)
    .eq("enabled", true);
  type T = {
    key: string; name: string; description: string | null;
    search_terms: string | null; always_include: boolean | null; active: boolean;
  };
  const tools = (vinculos ?? [])
    .map((r) => (r as unknown as { tool: T | null }).tool)
    .filter((t): t is T => !!t && t.active)
    .map((t) => ({
      key: t.key, name: t.name, description: t.description ?? "",
      searchTerms: t.search_terms ?? "", alwaysInclude: t.always_include === true,
    }));

  const { data: traces } = await db
    .from("ai_chat_traces")
    .select("pergunta, passos")
    .gt("created_at", new Date(Date.now() - DIAS * 86_400_000).toISOString())
    .not("passos", "is", null)
    .limit(2000);

  const passo = (ps: PassoTrace[], n: string) => ps.find((x) => x.passo === n)?.info;
  const todos = (ps: PassoTrace[], n: string) => ps.filter((x) => x.passo === n).map((x) => x.info);

  // Casos onde há reescrita E uma ferramenta que funcionou (o gabarito possível).
  type Caso = { pergunta: string; reescrita: string; alvo: string };
  const casos: Caso[] = [];
  for (const t of traces ?? []) {
    const ps = (t.passos ?? []) as PassoTrace[];
    const qr = passo(ps, "query_rewrite") as { pulado?: boolean; consulta?: string } | undefined;
    if (!qr || qr.pulado) continue;
    const reescrita = String(qr.consulta ?? "").trim();
    const pergunta = String(t.pergunta ?? "").trim();
    if (!reescrita || !pergunta || reescrita === pergunta) continue;
    // Ferramenta de INTEGRAÇÃO que terminou bem — as locais não passam por top-K.
    const oks = todos(ps, "tool_fim")
      .filter((f) => f?.ok === true && f?.familia === "integracao")
      .map((f) => String(f?.tool ?? ""))
      .filter(Boolean);
    if (!oks.length) continue;
    casos.push({ pergunta, reescrita, alvo: oks[0]! });
  }

  const amostra = casos.slice(0, MAX);
  console.log(`\n${casos.length} turnos com reescrita + ferramenta bem-sucedida · medindo ${amostra.length}`);
  console.log(`base ${BASE} · ${tools.length} ferramentas · teto do top-K ${TOP}\n`);

  let acertoOriginal = 0, acertoReescrita = 0, ambos = 0, nenhum = 0;
  const soOriginal: Caso[] = [], soReescrita: Caso[] = [];

  for (const c of amostra) {
    const [simO, simR] = await Promise.all([
      simTools(db, BASE, c.pergunta),
      simTools(db, BASE, c.reescrita),
    ]);
    if (!simO.size || !simR.size) continue;
    const o = selecionarTopK(tools, c.pergunta, TOP, undefined, simO).has(c.alvo);
    const r = selecionarTopK(tools, c.reescrita, TOP, undefined, simR).has(c.alvo);
    if (o) acertoOriginal++;
    if (r) acertoReescrita++;
    if (o && r) ambos++;
    else if (o) soOriginal.push(c);
    else if (r) soReescrita.push(c);
    else nenhum++;
  }

  const pct = (n: number) => `${((n / Math.max(1, amostra.length)) * 100).toFixed(0)}%`;
  console.log("── A ferramenta que funcionou chegou ao modelo? ".padEnd(64, "─"));
  console.log(`  com a PERGUNTA ORIGINAL   ${String(acertoOriginal).padStart(4)}  ${pct(acertoOriginal)}`);
  console.log(`  com a REESCRITA           ${String(acertoReescrita).padStart(4)}  ${pct(acertoReescrita)}`);
  console.log(`\n  as duas trouxeram         ${String(ambos).padStart(4)}`);
  console.log(`  SÓ a original trouxe      ${String(soOriginal.length).padStart(4)}   ← a reescrita CUSTOU estes`);
  console.log(`  SÓ a reescrita trouxe     ${String(soReescrita.length).padStart(4)}   ← a reescrita GANHOU estes`);
  console.log(`  nenhuma trouxe            ${String(nenhum).padStart(4)}`);

  // Os casos discordantes vão para leitura humana: é onde a decisão se ganha.
  const mostrar = (t: string, cs: Caso[]) => {
    if (!cs.length) return;
    console.log(`\n── ${t} `.padEnd(64, "─"));
    for (const c of cs.slice(0, 8)) {
      console.log(`  "${c.pergunta.slice(0, 46)}"`);
      console.log(`     reescrita: "${c.reescrita.slice(0, 46)}"   alvo: ${c.alvo}`);
    }
  };
  mostrar("A REESCRITA CUSTOU (só a original achou)", soOriginal);
  mostrar("A REESCRITA GANHOU (só ela achou)", soReescrita);
  console.log();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
