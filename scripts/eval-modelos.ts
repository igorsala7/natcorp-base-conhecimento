/**
 * QUAL MODELO ESCOLHE MELHOR A FERRAMENTA, E QUANTO CUSTA — read-only.
 *
 * Compara modelos de provedores diferentes na tarefa que decide o turno:
 * recebendo a MESMA pergunta, o MESMO conjunto de ferramentas e o MESMO prompt,
 * qual deles chama a ferramenta certa com os parâmetros certos?
 *
 * Tudo o mais é mantido idêntico de propósito. Comparar modelos com prompts ou
 * conjuntos de ferramentas diferentes não compara modelos — compara montagens.
 *
 * ── O que mede, e o que NÃO mede ────────────────────────────────────────────
 * Mede a DECISÃO: chamou a ferramenta esperada, com que parâmetros, em quantos
 * passos, a que custo. Não mede a qualidade do texto final — isso exigiria um
 * juiz, e um juiz é outro modelo com os mesmos vieses.
 *
 * As ferramentas são STUBS: registram a chamada e devolvem um resultado fixo.
 * O que se compara é a escolha, não os dados — e assim o teste não consome as
 * APIs do cliente nem depende de elas estarem no ar.
 *
 * Custo sai de `ai_model_prices` (a tabela do próprio sistema), não de preço
 * lembrado.
 *
 *   npm run eval:modelos
 *   npm run eval:modelos -- --n 10
 *   npm run eval:modelos -- --modelos anthropic:claude-haiku-4-5,openai:gpt-5.6-terra
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { generateText, tool, type ToolSet } from "ai";
import { z } from "zod";
import type { Database } from "../src/lib/database.types";
import { REGRAS_ABSOLUTAS, PERSONA_RH } from "../src/lib/ai/prompt-cascade";

if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === "undefined") {
  const { WebSocket } = await import("ws");
  (globalThis as { WebSocket?: unknown }).WebSocket = WebSocket;
}

const arg = (nome: string, padrao: string): string => {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : padrao;
};
const N = Number(arg("n", "12"));
const BASE = arg("base", "natcorp");
const ARQUIVO = arg("casos", "eval/casos.jsonl");
const MODELOS = arg(
  "modelos",
  [
    "google:gemini-3.5-flash-lite",
    "google:gemini-3.5-flash",
    "anthropic:claude-haiku-4-5",
    "anthropic:claude-sonnet-5",
    "openai:gpt-5.6-luna",
    "openai:gpt-5.6-terra",
  ].join(","),
).split(",").map((m) => m.trim()).filter(Boolean);

type Caso = { pergunta: string; faixa: string; espera_tool: string | null; espera_params?: Record<string, unknown> | null };

/**
 * Resolve `provedor:modelo` com a chave DO SISTEMA.
 *
 * As chaves ficam cifradas em `ai_provider_keys`, não no ambiente — é assim que
 * a produção funciona, e usar variável de ambiente aqui mediria uma configuração
 * que não existe. `tryDecryptSecret` é o mesmo helper de `config.ts`.
 */
async function montarProvedores(db: ReturnType<typeof createClient<Database>>) {
  const { tryDecryptSecret } = await import("../src/lib/crypto/secrets");
  const { data } = await db
    .from("ai_providers")
    .select("kind, ai_provider_keys(api_key_enc)")
    .eq("active", true);
  const porKind = new Map<string, string>();
  for (const p of data ?? []) {
    // O join volta como OBJETO (um-para-um) ou ARRAY conforme a relação — aceitar
    // as duas formas evita um "sem chave" que na verdade é forma inesperada.
    const rel = (p as unknown as { ai_provider_keys?: { api_key_enc?: string } | { api_key_enc?: string }[] }).ai_provider_keys;
    const enc = Array.isArray(rel) ? rel[0]?.api_key_enc : rel?.api_key_enc;
    const k = tryDecryptSecret(enc);
    if (k) porKind.set(String(p.kind), k);
  }
  return async (spec: string) => {
    const [kind, ...resto] = spec.split(":");
    const nome = resto.join(":");
    const apiKey = porKind.get(kind!);
    if (!apiKey) throw new Error(`sem chave para o provedor "${kind}"`);
    if (kind === "google") {
      const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
      return { nome, kind: kind!, model: createGoogleGenerativeAI({ apiKey })(nome) };
    }
    if (kind === "anthropic") {
      const { createAnthropic } = await import("@ai-sdk/anthropic");
      return { nome, kind: kind!, model: createAnthropic({ apiKey })(nome) };
    }
    const { createOpenAI } = await import("@ai-sdk/openai");
    return { nome, kind: kind!, model: createOpenAI({ apiKey })(nome) };
  };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) { console.error("Faltam credenciais do Supabase."); process.exit(1); }
  const db = createClient<Database>(url, chave, { auth: { persistSession: false } });
  const resolverModelo = await montarProvedores(db);

  // Preços do próprio sistema — nunca de memória.
  const { data: precos } = await db.from("ai_model_prices").select("provider, model, input_usd_mtok, output_usd_mtok");
  const preco = (kind: string, modelo: string) =>
    (precos ?? []).find((p) => p.provider === kind && p.model === modelo) ?? null;

  const { data: base } = await db.from("ai_bases").select("id").eq("base_code", BASE).maybeSingle();
  if (!base) { console.error(`Base "${BASE}" não encontrada.`); process.exit(1); }
  const { data: vinculos } = await db
    .from("ai_base_tools")
    .select("tool:ai_tools(key, name, description, params, active)")
    .eq("base_id", base.id).eq("enabled", true);
  type T = { key: string; name: string; description: string | null; params: unknown; active: boolean };
  const catalogo = (vinculos ?? [])
    .map((r) => (r as unknown as { tool: T | null }).tool)
    .filter((t): t is T => !!t && t.active);

  const casos: Caso[] = readFileSync(ARQUIVO, "utf8").trim().split("\n").filter(Boolean)
    .map((l) => JSON.parse(l) as Caso)
    .filter((c) => c.espera_tool);
  const amostra = casos.slice(0, N);

  console.log(`\n${amostra.length} casos · ${MODELOS.length} modelos · ${catalogo.length} ferramentas no catálogo`);
  console.log("mesmo prompt, mesmas ferramentas, mesma pergunta — só o modelo muda\n");

  const sistema = `${PERSONA_RH}\n\n${REGRAS_ABSOLUTAS}`;
  type Placar = { acertos: number; medidos: number; entrada: number; saida: number; chamadas: number; erros: number; ms: number };
  const placar = new Map<string, Placar>();
  const divergiu: { pergunta: string; esperado: string; escolhas: Record<string, string> }[] = [];

  for (const spec of MODELOS) placar.set(spec, { acertos: 0, medidos: 0, entrada: 0, saida: 0, chamadas: 0, erros: 0, ms: 0 });

  for (const caso of amostra) {
    const escolhas: Record<string, string> = {};
    for (const spec of MODELOS) {
      const p = placar.get(spec)!;
      // Ferramentas do turno: a esperada + um recorte do catálogo, igual para
      // todos os modelos. Sem a esperada no conjunto, mediríamos a seleção, não
      // o modelo — e a seleção já foi medida em eval-tools.
      const doTurno = [
        ...catalogo.filter((t) => t.key === caso.espera_tool),
        ...catalogo.filter((t) => t.key !== caso.espera_tool).slice(0, 9),
      ];
      const chamadas: { tool: string; args: unknown }[] = [];
      const tools: ToolSet = {};
      for (const t of doTurno) {
        const campos: Record<string, z.ZodTypeAny> = {};
        for (const par of (Array.isArray(t.params) ? t.params : []) as { nome?: string; descricao?: string; origem?: string }[]) {
          if (par?.origem !== "modelo" && par?.origem !== "pessoa") continue;
          const nome = String(par.nome ?? "").replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 64);
          if (nome) campos[nome] = z.string().optional().describe(String(par.descricao ?? "").slice(0, 200));
        }
        tools[t.key] = tool({
          description: String(t.description ?? t.name).slice(0, 900),
          inputSchema: z.object(campos),
          execute: async (args: Record<string, unknown>) => {
            chamadas.push({ tool: t.key, args });
            // Resultado FIXO: o que se mede é a escolha, não os dados.
            return { items: [{ ok: true }], _total: 1, _completo: true };
          },
        });
      }

      const t0 = Date.now();
      try {
        const { model, kind, nome } = await resolverModelo(spec);
        const r = await generateText({
          model,
          system: sistema,
          prompt: caso.pergunta,
          tools,
          maxOutputTokens: 700,
        });
        p.ms += Date.now() - t0;
        p.medidos++;
        const usadas = chamadas.map((c) => c.tool);
        const ok = usadas.includes(caso.espera_tool!);
        if (ok) p.acertos++;
        p.chamadas += chamadas.length;
        p.entrada += r.usage?.inputTokens ?? 0;
        p.saida += r.usage?.outputTokens ?? 0;
        escolhas[spec] = usadas.length ? usadas.join(", ") : "(nenhuma)";
        void kind; void nome;
      } catch (e) {
        p.erros++;
        escolhas[spec] = `ERRO: ${(e as Error).message.slice(0, 40)}`;
        if (p.erros === 1) console.error(`  [${spec}] ${(e as Error).message.slice(0, 200)}`);
      }
    }
    const acertaram = new Set(Object.values(escolhas).map((v) => v.includes(caso.espera_tool!)));
    if (acertaram.size > 1) divergiu.push({ pergunta: caso.pergunta, esperado: caso.espera_tool!, escolhas });
  }

  /**
   * A medição custa minutos e chamadas de API pagas — gravar o resultado não é
   * conveniência, é o mínimo. Perdi uma rodada inteira por ela existir só no
   * terminal (19/08/2026).
   */
  const md: string[] = [`# Comparação de modelos — ${new Date().toISOString().slice(0, 16).replace("T", " ")}`, ""];
  md.push(`${amostra.length} casos · mesmo prompt, mesmas ferramentas, mesma pergunta — só o modelo muda.`, "");
  md.push("| modelo | acerto | tokens in | out | US$/1k turnos | s/turno |", "|---|---|---|---|---|---|");

  console.log("── PLACAR ".padEnd(88, "─"));
  console.log("  modelo".padEnd(34) + "acerto".padStart(10) + "tokens in".padStart(12) + "out".padStart(9) + "US$/1k turnos".padStart(16) + "s/turno".padStart(9));
  const linhas: { spec: string; pct: number; usd: number }[] = [];
  for (const [spec, p] of placar) {
    if (!p.medidos) { console.log(`  ${spec.padEnd(32)} — sem medição (${p.erros} erro(s))`); continue; }
    const [kind, ...r] = spec.split(":");
    const pr = preco(kind!, r.join(":"));
    const usdTurno = pr
      ? (p.entrada / p.medidos / 1e6) * Number(pr.input_usd_mtok) + (p.saida / p.medidos / 1e6) * Number(pr.output_usd_mtok)
      : NaN;
    const pct = (p.acertos / p.medidos) * 100;
    linhas.push({ spec, pct, usd: usdTurno });
    console.log(
      `  ${spec.padEnd(32)}` +
        `${p.acertos}/${p.medidos}`.padStart(10) +
        `${Math.round(p.entrada / p.medidos)}`.padStart(12) +
        `${Math.round(p.saida / p.medidos)}`.padStart(9) +
        `${Number.isFinite(usdTurno) ? (usdTurno * 1000).toFixed(2) : "?"}`.padStart(16) +
        `${(p.ms / p.medidos / 1000).toFixed(1)}`.padStart(9),
    );
    md.push(
      `| \`${spec}\` | ${p.acertos}/${p.medidos} (${pct.toFixed(0)}%) | ${Math.round(p.entrada / p.medidos)} | ` +
        `${Math.round(p.saida / p.medidos)} | ${Number.isFinite(usdTurno) ? (usdTurno * 1000).toFixed(2) : "?"} | ` +
        `${(p.ms / p.medidos / 1000).toFixed(1)} |`,
    );
  }

  const bons = linhas.filter((l) => Number.isFinite(l.usd)).sort((a, b) => b.pct - a.pct || a.usd - b.usd);
  if (bons.length) {
    console.log(`\n  melhor acerto: ${bons[0]!.spec} (${bons[0]!.pct.toFixed(0)}%)`);
    const barato = [...bons].sort((a, b) => a.usd - b.usd)[0]!;
    console.log(`  mais barato:   ${barato.spec} (US$ ${(barato.usd * 1000).toFixed(2)}/1k turnos, ${barato.pct.toFixed(0)}%)`);
  }

  if (divergiu.length) {
    console.log(`\n── ONDE OS MODELOS DISCORDARAM (${divergiu.length}) `.padEnd(88, "─"));
    for (const d of divergiu.slice(0, 8)) {
      console.log(`\n  "${d.pergunta.slice(0, 58)}"   esperado: ${d.esperado}`);
      for (const [spec, v] of Object.entries(d.escolhas)) {
        console.log(`     ${v.includes(d.esperado) ? "OK " : "-- "} ${spec.padEnd(30)} ${v.slice(0, 40)}`);
      }
    }
  }
  if (divergiu.length) {
    md.push("", "## Onde os modelos discordaram", "");
    for (const d of divergiu) {
      md.push(`**"${d.pergunta.slice(0, 70)}"** — esperado \`${d.esperado}\``, "");
      for (const [spec, v] of Object.entries(d.escolhas)) {
        md.push(`- ${v.includes(d.esperado) ? "✅" : "❌"} \`${spec}\` → ${v.slice(0, 60)}`);
      }
      md.push("");
    }
  }
  if (!existsSync("eval")) mkdirSync("eval", { recursive: true });
  writeFileSync("eval/modelos.md", md.join("\n") + "\n", "utf8");
  console.log("\n  gravado em eval/modelos.md");
  console.log();
}

main().catch((e) => { console.error(e); process.exit(1); });
