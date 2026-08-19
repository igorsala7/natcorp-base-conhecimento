/**
 * O MODELO DECIDE CERTO QUANDO RECEBE O TURNO INTEIRO? — read-only.
 *
 * `eval-modelos.ts` manda a pergunta ISOLADA e por isso mede um sistema que não
 * é este: metade dos turnos reais são continuações ("Tudo junto", "Pode
 * enviar", "Opção 2"), e sem o histórico nenhum modelo tem como acertar. Foi o
 * que produziu os 25–50% da primeira rodada.
 *
 * Aqui cada caso de `eval/cenarios.jsonl` é REMONTADO com o que o turno tinha:
 * histórico da conversa, tabelas da tela e — decisivo — exatamente as
 * ferramentas que o funil entregou ao modelo naquele turno. Isso isola o MODELO
 * da seleção: a seleção já foi medida em `eval-tools`, e misturar as duas dá um
 * número que não diz o que corrigir.
 *
 * ── As duas notas, e por que são separadas ──────────────────────────────────
 * FERRAMENTA — chamou a que o gabarito manda (ou nenhuma, quando é isso que se
 * espera).
 * PERGUNTA — perguntou quando devia e ficou quieto quando não devia. O dono
 * ditou os dois lados: "se o agente tiver dúvidas ele deve perguntar, mas sem
 * perguntas para coisas que estão muito óbvias".
 *
 * Um modelo que pergunta sempre acerta metade da segunda nota e destrói a
 * experiência. Somar as duas esconderia isso; então não se soma.
 *
 * A pergunta vira uma FERRAMENTA (`perguntar_ao_usuario`) para ser medível
 * pelo mesmo caminho da decisão de ferramenta — texto interrogativo na resposta
 * seria detectado por heurística, e heurística de medição vira ruído de medição.
 *
 * ── O que é fiel e o que é aproximado ───────────────────────────────────────
 * FIEL: pergunta, histórico, ferramentas ofertadas, prompt de sistema.
 * APROXIMADO: o CONTEÚDO das tabelas da tela — o trace guarda colunas e
 * contagem, não as células. O bloco declara a limitação em vez de inventar
 * linhas, porque a decisão de roteamento usa a forma, não os valores.
 *
 * Casos cujo gabarito exige uma ferramenta que o funil NÃO entregou são falha
 * de funil, não de modelo: saem do placar e vão para uma lista própria.
 *
 *   npm run eval:cenarios-modelo
 *   npm run eval:cenarios-modelo -- --modelos anthropic:claude-haiku-4-5 --n 10
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { generateText, tool, type ToolSet, type ModelMessage } from "ai";
import { z } from "zod";
import type { Database } from "../src/lib/database.types";
import { REGRAS_ABSOLUTAS, PERSONA_RH } from "../src/lib/ai/prompt-cascade";
import { integUsageDirective } from "../src/lib/chat/report-tools";

if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === "undefined") {
  const { WebSocket } = await import("ws");
  (globalThis as { WebSocket?: unknown }).WebSocket = WebSocket;
}

const arg = (nome: string, padrao: string): string => {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : padrao;
};
const N = Number(arg("n", "99"));
const BASE = arg("base", "natcorp");
const ARQUIVO = arg("casos", "eval/cenarios.jsonl");
const SAIDA = arg("saida", "eval/cenarios.md");
const MODELOS = arg(
  "modelos",
  ["google:gemini-3.5-flash", "anthropic:claude-haiku-4-5", "anthropic:claude-sonnet-5", "openai:gpt-5.6-terra"].join(","),
).split(",").map((m) => m.trim()).filter(Boolean);

type Caso = {
  cenario: string;
  pergunta: string;
  historico: { role: string; content: string }[];
  portal: string | null;
  tela: { id: string; linhas: number; colunas: string[] }[];
  ofertadas: string[];
  espera_tool: string | null;
  espera_fonte: string;
  espera_clarify: boolean;
  nota?: string;
  revisar?: boolean;
};

/** Mesma resolução de `eval-modelos.ts`: chave cifrada do sistema, não do ambiente. */
async function montarProvedores(db: ReturnType<typeof createClient<Database>>) {
  const { tryDecryptSecret } = await import("../src/lib/crypto/secrets");
  const { data } = await db.from("ai_providers").select("kind, ai_provider_keys(api_key_enc)").eq("active", true);
  const porKind = new Map<string, string>();
  for (const p of data ?? []) {
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
      return createGoogleGenerativeAI({ apiKey })(nome);
    }
    if (kind === "anthropic") {
      const { createAnthropic } = await import("@ai-sdk/anthropic");
      return createAnthropic({ apiKey })(nome);
    }
    const { createOpenAI } = await import("@ai-sdk/openai");
    return createOpenAI({ apiKey })(nome);
  };
}

/** As tabelas da tela, pela FORMA — o trace não guarda células. */
function blocoDaTela(tela: Caso["tela"]): string {
  if (!tela.length) return "";
  const linhas = tela.map((t) => `- \`${t.id}\` · ${t.linhas} linhas · colunas: ${t.colunas.join(", ")}`);
  return [
    "TABELAS ABERTAS NA TELA DO USUÁRIO AGORA:",
    ...linhas,
    "(as células não estão neste contexto de avaliação; use as ferramentas de consulta para lê-las)",
  ].join("\n");
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) { console.error("Faltam credenciais do Supabase."); process.exit(1); }
  const db = createClient<Database>(url, chave, { auth: { persistSession: false } });
  const resolverModelo = await montarProvedores(db);

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
  const catalogo = new Map<string, T>();
  for (const r of vinculos ?? []) {
    const t = (r as unknown as { tool: T | null }).tool;
    if (t?.active) catalogo.set(t.key, t);
  }

  const todos: Caso[] = readFileSync(ARQUIVO, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as Caso);
  const semGabarito = todos.filter((c) => c.revisar);
  // Gabarito exigindo ferramenta que o funil não entregou: falha de funil.
  const doFunil = todos.filter((c) => !c.revisar && c.espera_tool && !c.ofertadas.includes(c.espera_tool));
  const amostra = todos.filter((c) => !c.revisar && !doFunil.includes(c)).slice(0, N);

  console.log(`\n${amostra.length} casos medíveis · ${MODELOS.length} modelos`);
  if (semGabarito.length) console.log(`${semGabarito.length} ainda sem gabarito — fora do placar`);
  if (doFunil.length) console.log(`${doFunil.length} são falha de FUNIL (a ferramenta certa não chegou ao modelo) — fora do placar`);
  console.log("mesmo histórico, mesma tela, mesmas ferramentas — só o modelo muda\n");

  type Placar = {
    tOk: number; tMed: number;             // ferramenta
    pOk: number; pMed: number;             // pergunta
    perguntouDemais: number; perguntouDeMenos: number;
    entrada: number; saida: number; erros: number; ms: number;
  };
  const placar = new Map<string, Placar>();
  for (const spec of MODELOS) {
    placar.set(spec, { tOk: 0, tMed: 0, pOk: 0, pMed: 0, perguntouDemais: 0, perguntouDeMenos: 0, entrada: 0, saida: 0, erros: 0, ms: 0 });
  }
  const detalhe: { caso: Caso; por: Record<string, { usadas: string[]; perguntou: boolean; ok: boolean }> }[] = [];

  for (const caso of amostra) {
    const por: Record<string, { usadas: string[]; perguntou: boolean; ok: boolean }> = {};
    for (const spec of MODELOS) {
      const p = placar.get(spec)!;
      const chamadas: string[] = [];
      const tools: ToolSet = {};

      // A pergunta é uma ferramenta: medível pelo mesmo caminho da decisão.
      tools.perguntar_ao_usuario = tool({
        description:
          "Use APENAS quando faltar algo que MUDA o resultado e não dá para deduzir do histórico nem da tela. " +
          "Não use para pedido óbvio, mensagem curta com contexto claro, ou repetição do que já foi pedido.",
        inputSchema: z.object({ pergunta: z.string(), opcoes: z.array(z.string()).optional() }),
        execute: async () => { chamadas.push("perguntar_ao_usuario"); return { aguardando: true }; },
      });

      for (const key of caso.ofertadas) {
        const t = catalogo.get(key);
        const campos: Record<string, z.ZodTypeAny> = {};
        for (const par of (Array.isArray(t?.params) ? t!.params : []) as { nome?: string; descricao?: string; origem?: string }[]) {
          if (par?.origem !== "modelo" && par?.origem !== "pessoa") continue;
          const nome = String(par.nome ?? "").replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 64);
          if (nome) campos[nome] = z.string().optional().describe(String(par.descricao ?? "").slice(0, 200));
        }
        tools[key] = tool({
          description: String(t?.description ?? t?.name ?? key).slice(0, 900),
          inputSchema: z.object(campos),
          execute: async () => { chamadas.push(key); return { items: [{ ok: true }], _total: 1, _completo: true }; },
        });
      }

      const sistema = [PERSONA_RH, REGRAS_ABSOLUTAS, integUsageDirective(), blocoDaTela(caso.tela)]
        .filter(Boolean).join("\n\n");
      // Mensagem de conteúdo vazio existe no histórico real (turno que morreu antes
      // de escrever) e a Anthropic RECUSA o payload inteiro por causa dela — o que
      // derrubava dois modelos e viraria "sem medição" em vez de comparação.
      const messages: ModelMessage[] = [
        ...caso.historico
          .filter((h) => String(h.content ?? "").trim().length > 0)
          .map((h) => ({
            role: h.role === "assistant" ? ("assistant" as const) : ("user" as const),
            content: h.content.trim(),
          })),
        { role: "user", content: caso.pergunta },
      ];

      const t0 = Date.now();
      try {
        const model = await resolverModelo(spec);
        const r = await generateText({ model, system: sistema, messages, tools, maxOutputTokens: 700 });
        p.ms += Date.now() - t0;
        p.entrada += r.usage?.inputTokens ?? 0;
        p.saida += r.usage?.outputTokens ?? 0;

        const perguntou = chamadas.includes("perguntar_ao_usuario");
        const usadas = chamadas.filter((c) => c !== "perguntar_ao_usuario");

        // FERRAMENTA — `espera_tool: null` significa "nenhuma ferramenta de dado".
        p.tMed++;
        const tOk = caso.espera_tool ? usadas.includes(caso.espera_tool) : usadas.length === 0;
        if (tOk) p.tOk++;

        // PERGUNTA — os dois lados contam, e cada erro tem nome próprio.
        p.pMed++;
        if (perguntou === caso.espera_clarify) p.pOk++;
        else if (perguntou) p.perguntouDemais++;
        else p.perguntouDeMenos++;

        por[spec] = { usadas, perguntou, ok: tOk && perguntou === caso.espera_clarify };
      } catch (e) {
        p.erros++;
        por[spec] = { usadas: [`ERRO: ${(e as Error).message.slice(0, 40)}`], perguntou: false, ok: false };
        if (p.erros === 1) console.error(`  [${spec}] ${(e as Error).message.slice(0, 200)}`);
      }
    }
    const acertos = new Set(Object.values(por).map((v) => v.ok));
    if (acertos.size > 1 || !acertos.has(true)) detalhe.push({ caso, por });
    process.stdout.write(".");
  }
  console.log("\n");

  const md: string[] = [
    `# Cenários com contexto — ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
    "",
    `${amostra.length} casos remontados com histórico, tela e as ferramentas que o funil realmente entregou.`,
    "",
    "| modelo | ferramenta | pergunta | perguntou demais | de menos | tok in | US$/1k | s |",
    "|---|---|---|---|---|---|---|---|",
  ];

  console.log("── PLACAR ".padEnd(96, "─"));
  console.log(
    "  modelo".padEnd(32) + "ferramenta".padStart(12) + "pergunta".padStart(11) +
    "demais".padStart(9) + "de menos".padStart(10) + "tok in".padStart(9) + "US$/1k".padStart(9) + "s".padStart(7),
  );
  for (const [spec, p] of placar) {
    if (!p.tMed) { console.log(`  ${spec.padEnd(30)} — sem medição (${p.erros} erro(s))`); continue; }
    const [kind, ...r] = spec.split(":");
    const pr = preco(kind!, r.join(":"));
    const usd = pr
      ? ((p.entrada / p.tMed / 1e6) * Number(pr.input_usd_mtok) + (p.saida / p.tMed / 1e6) * Number(pr.output_usd_mtok)) * 1000
      : NaN;
    const pctT = (p.tOk / p.tMed) * 100, pctP = (p.pOk / p.pMed) * 100;
    console.log(
      `  ${spec.padEnd(30)}` +
      `${p.tOk}/${p.tMed}`.padStart(12) + `${p.pOk}/${p.pMed}`.padStart(11) +
      `${p.perguntouDemais}`.padStart(9) + `${p.perguntouDeMenos}`.padStart(10) +
      `${Math.round(p.entrada / p.tMed)}`.padStart(9) +
      `${Number.isFinite(usd) ? usd.toFixed(2) : "?"}`.padStart(9) +
      `${(p.ms / p.tMed / 1000).toFixed(1)}`.padStart(7),
    );
    md.push(
      `| \`${spec}\` | ${p.tOk}/${p.tMed} (${pctT.toFixed(0)}%) | ${p.pOk}/${p.pMed} (${pctP.toFixed(0)}%) | ` +
      `${p.perguntouDemais} | ${p.perguntouDeMenos} | ${Math.round(p.entrada / p.tMed)} | ` +
      `${Number.isFinite(usd) ? usd.toFixed(2) : "?"} | ${(p.ms / p.tMed / 1000).toFixed(1)} |`,
    );
  }

  if (doFunil.length) {
    console.log(`\n── FALHA DE FUNIL: a ferramenta certa não chegou ao modelo (${doFunil.length}) `.padEnd(96, "─"));
    md.push("", "## Falha de funil — nenhum modelo pode passar nestes", "");
    for (const c of doFunil) {
      console.log(`  "${c.pergunta.slice(0, 52)}"  precisava de ${c.espera_tool}`);
      md.push(`- **"${c.pergunta.slice(0, 70)}"** precisava de \`${c.espera_tool}\` — ${c.nota ?? ""}`);
    }
  }

  if (detalhe.length) {
    console.log(`\n── ONDE ERRARAM OU DISCORDARAM (${detalhe.length}) `.padEnd(96, "─"));
    md.push("", "## Onde erraram ou discordaram", "");
    for (const d of detalhe) {
      const alvo = d.caso.espera_tool ?? "(nenhuma)";
      const q = d.caso.espera_clarify ? " + PERGUNTAR" : "";
      console.log(`\n  "${d.caso.pergunta.slice(0, 56)}"   esperado: ${alvo}${q}`);
      md.push(`**"${d.caso.pergunta.slice(0, 70)}"** — esperado \`${alvo}\`${q}`, "");
      for (const [spec, v] of Object.entries(d.por)) {
        const txt = `${v.usadas.join(", ") || "(nenhuma)"}${v.perguntou ? " + perguntou" : ""}`;
        console.log(`     ${v.ok ? "OK " : "-- "} ${spec.padEnd(28)} ${txt.slice(0, 44)}`);
        md.push(`- ${v.ok ? "✅" : "❌"} \`${spec}\` → ${txt.slice(0, 60)}`);
      }
      md.push("");
    }
  }

  const dir = SAIDA.slice(0, SAIDA.lastIndexOf("/"));
  if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(SAIDA, md.join("\n") + "\n", "utf8");
  console.log(`\nEscrito em ${SAIDA}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
