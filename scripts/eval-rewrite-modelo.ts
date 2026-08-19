/**
 * A REESCRITA MELHORA COM UM MODELO MELHOR? — read-only na produção.
 *
 * A reescrita decide qual pergunta o sistema vai responder, e hoje roda no
 * MENOR modelo do conjunto (`gemini-3.5-flash-lite`). O mesmo perfil
 * `query_rewrite` também alimenta o classificador de módulo, o desambiguador de
 * sujeito e o roteador de fonte — ou seja, os julgamentos mais difíceis do
 * turno estão no modelo mais barato, enquanto a redação (a parte fácil) está
 * num maior.
 *
 * `eval-rewrite.ts` já mostrou que a reescrita AJUDA (ganha de 15 a 2 contra a
 * pergunta crua). A pergunta que sobra é outra: quanto dos erros restantes é do
 * MODELO, e não do desenho?
 *
 * ── Como mede ───────────────────────────────────────────────────────────────
 * Reconstrói cada turno com o HISTÓRICO REAL da conversa — sem ele, reescrever
 * "sim" ou "205818" não mede nada, e são justamente esses os casos que a
 * reescrita existe para resolver. Roda o MESMO prompt em cada modelo e compara
 * pelo mesmo caminho semântico do chat.
 *
 * Gabarito: a ferramenta de integração que o agente chamou e que funcionou.
 * Imperfeito — ele pode ter chamado a errada sem ninguém corrigir —, mas é
 * idêntico para todos os modelos, então serve para COMPARAR.
 *
 *   npm run eval:rewrite-modelo
 *   npm run eval:rewrite-modelo -- --modelos gemini-3.5-flash-lite,gemini-3.5-flash --n 40
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";
import { simTools } from "../src/lib/integrations/tool-catalog";
import { selecionarTopK } from "../src/lib/integrations/tool-narrow";
import { interpretarConsulta } from "../src/lib/ai/query-understanding";

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
const N = Number(arg("n", "30"));
const MODELOS = arg("modelos", "gemini-3.5-flash-lite,gemini-3.5-flash").split(",").map((m) => m.trim());

type PassoTrace = { passo: string; info?: Record<string, unknown> | null };

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) {
    console.error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }
  const db = createClient<Database>(url, chave, { auth: { persistSession: false } });
  const { google } = await import("@ai-sdk/google");

  const { data: base } = await db.from("ai_bases").select("id").eq("base_code", BASE).maybeSingle();
  if (!base) { console.error(`Base "${BASE}" não encontrada.`); process.exit(1); }
  const { data: vinculos } = await db
    .from("ai_base_tools")
    .select("tool:ai_tools(key, name, description, search_terms, always_include, active)")
    .eq("base_id", base.id).eq("enabled", true);
  type T = { key: string; name: string; description: string | null; search_terms: string | null; always_include: boolean | null; active: boolean };
  const tools = (vinculos ?? [])
    .map((r) => (r as unknown as { tool: T | null }).tool)
    .filter((t): t is T => !!t && t.active)
    .map((t) => ({ key: t.key, name: t.name, description: t.description ?? "", searchTerms: t.search_terms ?? "", alwaysInclude: t.always_include === true }));

  const { data: traces } = await db
    .from("ai_chat_traces")
    .select("conversation_id, space_id, pergunta, passos, created_at")
    .gt("created_at", new Date(Date.now() - DIAS * 86_400_000).toISOString())
    .not("passos", "is", null)
    .order("created_at", { ascending: false })
    .limit(600);

  const passo = (ps: PassoTrace[], n: string) => ps.find((x) => x.passo === n)?.info;
  const todos = (ps: PassoTrace[], n: string) => ps.filter((x) => x.passo === n).map((x) => x.info);

  type Caso = { pergunta: string; alvo: string; conversationId: string; spaceId: string; quando: string; original: string };
  const casos: Caso[] = [];
  for (const t of traces ?? []) {
    const ps = (t.passos ?? []) as PassoTrace[];
    const qr = passo(ps, "query_rewrite") as { pulado?: boolean; consulta?: string } | undefined;
    if (!qr || qr.pulado || !t.conversation_id || !t.space_id) continue;
    const oks = todos(ps, "tool_fim")
      .filter((f) => f?.ok === true && f?.familia === "integracao")
      .map((f) => String(f?.tool ?? "")).filter(Boolean);
    if (!oks.length) continue;
    casos.push({
      pergunta: String(t.pergunta ?? "").trim(),
      alvo: oks[0]!,
      conversationId: t.conversation_id as string,
      spaceId: t.space_id as string,
      quando: t.created_at as string,
      original: String(qr.consulta ?? ""),
    });
  }
  const amostra = casos.slice(0, N);
  console.log(`\n${casos.length} turnos elegíveis · medindo ${amostra.length}`);
  console.log(`modelos: ${MODELOS.join(" · ")}\n`);

  const placar = new Map<string, { acertos: number; medidos: number; iguais: number }>();
  for (const m of MODELOS) placar.set(m, { acertos: 0, medidos: 0, iguais: 0 });
  const discordancias: { pergunta: string; alvo: string; porModelo: Record<string, { r: string; ok: boolean }> }[] = [];

  for (const c of amostra) {
    // HISTÓRICO REAL até o instante do turno — é o que dá sentido a "sim" e "205818".
    const { data: msgs } = await db
      .from("messages")
      .select("role, content, created_at")
      .eq("conversation_id", c.conversationId)
      .lt("created_at", c.quando)
      .order("created_at", { ascending: true })
      .limit(12);
    const historico = [
      ...(msgs ?? []).map((m) => ({ role: String(m.role), content: String(m.content ?? "").slice(0, 900) })),
      { role: "user", content: c.pergunta },
    ];

    const porModelo: Record<string, { r: string; ok: boolean }> = {};
    for (const nome of MODELOS) {
      let reescrita = c.pergunta;
      try {
        reescrita = await interpretarConsulta(c.spaceId, c.pergunta, historico, "", google(nome));
      } catch {
        continue; // modelo indisponível: não conta como erro dele nem como acerto
      }
      const sim = await simTools(db, BASE, reescrita);
      if (!sim.size) continue;
      const ok = selecionarTopK(tools, reescrita, TOP, undefined, sim).has(c.alvo);
      const p = placar.get(nome)!;
      p.medidos++;
      if (ok) p.acertos++;
      porModelo[nome] = { r: reescrita, ok };
    }
    const vals = Object.values(porModelo);
    if (vals.length === MODELOS.length && new Set(vals.map((v) => v.ok)).size > 1) {
      discordancias.push({ pergunta: c.pergunta, alvo: c.alvo, porModelo });
    }
  }

  console.log("── A ferramenta que funcionou chegou ao modelo? ".padEnd(64, "─"));
  for (const [nome, p] of placar) {
    const pct = p.medidos ? ((p.acertos / p.medidos) * 100).toFixed(0) : "—";
    console.log(`  ${nome.padEnd(28)} ${String(p.acertos).padStart(3)}/${String(p.medidos).padEnd(3)}  ${pct}%`);
  }

  if (discordancias.length) {
    console.log(`\n── ONDE DISCORDARAM (${discordancias.length}) `.padEnd(64, "─"));
    for (const d of discordancias.slice(0, 10)) {
      console.log(`\n  "${d.pergunta.slice(0, 56)}"   alvo: ${d.alvo}`);
      for (const [nome, v] of Object.entries(d.porModelo)) {
        console.log(`     ${v.ok ? "OK " : "ERR"} ${nome.padEnd(24)} "${v.r.slice(0, 52)}"`);
      }
    }
  } else {
    console.log("\nNenhuma discordância — os modelos levaram à mesma seleção em todos os casos.");
  }
  console.log();
}

main().catch((e) => { console.error(e); process.exit(1); });
