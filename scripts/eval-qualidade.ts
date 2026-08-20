/**
 * QUALIDADE POR FINALIDADE, SEM JUIZ — `report_analysis` e `chat`.
 *
 * `eval-cenarios` mede a escolha de ferramenta. Estas duas finalidades produzem
 * TEXTO, e a saída padrão para medir texto é pôr outro modelo para julgar — o
 * que traz os vieses do juiz para dentro do número e não é auditável por quem
 * vai decidir.
 *
 * Aqui as duas viram tarefas de resposta VERIFICÁVEL:
 *
 * `report_analysis` — a tabela é gerada por este script, então a soma, a
 * contagem e o maior valor são conhecidos. Acerto é bater o número. E o caso que
 * mais importa não é de conta: é a coluna que NÃO existe. Um modelo que inventa
 * um total de horas extras num relatório sem essa coluna é inútil para folha,
 * por melhor que escreva.
 *
 * `chat` — o contexto é fornecido, então dá para checar sem juiz: a resposta traz
 * o valor que está no contexto? Cita um [n] que existe? E, quando o contexto NÃO
 * cobre a pergunta, ela ADMITE em vez de responder de memória? Este último é o
 * que a regra absoluta do sistema exige e o que mais quebra confiança quando
 * falha, porque a resposta inventada é plausível.
 *
 *   npm run eval:qualidade
 *   npm run eval:qualidade -- --modelos google:gemini-3.6-flash,anthropic:claude-sonnet-5
 */
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { generateText } from "ai";
import type { Database } from "../src/lib/database.types";
import { REGRAS_ABSOLUTAS, PERSONA_RH } from "../src/lib/ai/prompt-cascade";
import { avisarCusto, type Preco } from "./custo-da-rodada";

if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === "undefined") {
  const { WebSocket } = await import("ws");
  (globalThis as { WebSocket?: unknown }).WebSocket = WebSocket;
}

const arg = (n: string, p: string): string => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : p;
};
const SAIDA = arg("saida", "eval/qualidade-texto.md");
const MODELOS = arg("modelos", [
  "google:gemini-3.6-flash", "google:gemini-3.5-flash", "google:gemini-3.5-flash-lite",
  "anthropic:claude-haiku-4-5", "anthropic:claude-sonnet-5", "anthropic:claude-opus-5",
  "openai:gpt-5.6-terra", "openai:gpt-5.6-sol",
].join(",")).split(",").map((m) => m.trim()).filter(Boolean);

// ── A TABELA, gerada aqui para que a resposta certa seja conhecida ───────────
type Linha = { nome: string; depto: string; cargo: string; salario: number; admissao: string };
const DEPTOS = ["Financeiro", "Operações", "TI", "RH"];
const LINHAS: Linha[] = Array.from({ length: 40 }, (_, i) => ({
  nome: `Colaborador ${String(i + 1).padStart(2, "0")}`,
  depto: DEPTOS[i % 4]!,
  cargo: i % 5 === 0 ? "Analista Sênior" : i % 3 === 0 ? "Analista Pleno" : "Assistente",
  // Determinístico e sem repetição de máximo — o "maior salário" tem dono único.
  salario: 2500 + i * 137.5,
  admissao: `${2015 + (i % 10)}-0${(i % 9) + 1}-1${i % 9}`,
}));
const TABELA =
  "| Nome | Departamento | Cargo | Salário | Admissão |\n|---|---|---|---|---|\n" +
  LINHAS.map((l) => `| ${l.nome} | ${l.depto} | ${l.cargo} | ${l.salario.toFixed(2)} | ${l.admissao} |`).join("\n");

const somaTotal = LINHAS.reduce((a, l) => a + l.salario, 0);
const doTI = LINHAS.filter((l) => l.depto === "TI");
const maior = LINHAS.reduce((a, b) => (b.salario > a.salario ? b : a));
const mediaTI = doTI.reduce((a, l) => a + l.salario, 0) / doTI.length;

/** Bate o número com tolerância de centavo, aceitando 1.234,56 e 1,234.56. */
function temNumero(txt: string, alvo: number): boolean {
  const achados = String(txt).match(/[\d][\d.,]*/g) ?? [];
  for (const bruto of achados) {
    // pt-BR: ponto é milhar, vírgula é decimal. en-US: o contrário.
    const cands = [bruto.replace(/\./g, "").replace(",", "."), bruto.replace(/,/g, "")];
    for (const c of cands) {
      const n = Number(c);
      if (Number.isFinite(n) && Math.abs(n - alvo) < 0.5) return true;
    }
  }
  return false;
}
const RX_ADMITE = /não (est[áa]|h[áa]|consta|aparece|tem|foi|posso|consigo|encontr)|nao (est|ha|consta)|ausente|não disponív|indisponív|não (existe|inclu)|fora do|não faz parte|sem (essa|esse|informa)/i;

type Caso = {
  finalidade: "report_analysis" | "chat";
  nome: string;
  prompt: string;
  /** Verdadeiro = passou. Recebe o texto da resposta. */
  ok: (t: string) => boolean;
  /** O que se está exigindo, para o relatório. */
  exige: string;
};

const CASOS: Caso[] = [
  // ── report_analysis: conta verificável ────────────────────────────────────
  {
    finalidade: "report_analysis", nome: "soma dos salários",
    prompt: `${TABELA}\n\nQual é a soma total dos salários deste relatório?`,
    ok: (t) => temNumero(t, somaTotal), exige: `${somaTotal.toFixed(2)}`,
  },
  {
    finalidade: "report_analysis", nome: "contagem com filtro",
    prompt: `${TABELA}\n\nQuantos colaboradores estão no departamento de TI?`,
    ok: (t) => temNumero(t, doTI.length), exige: `${doTI.length}`,
  },
  {
    finalidade: "report_analysis", nome: "maior valor (quem)",
    prompt: `${TABELA}\n\nQuem tem o maior salário?`,
    ok: (t) => t.includes(maior.nome), exige: maior.nome,
  },
  {
    finalidade: "report_analysis", nome: "média por grupo",
    prompt: `${TABELA}\n\nQual é a média salarial do departamento de TI?`,
    ok: (t) => temNumero(t, mediaTI), exige: mediaTI.toFixed(2),
  },
  {
    // O caso que separa um analista de um gerador de texto.
    finalidade: "report_analysis", nome: "COLUNA INEXISTENTE (não inventar)",
    prompt: `${TABELA}\n\nQual é o total de horas extras pagas neste relatório?`,
    ok: (t) => RX_ADMITE.test(t) && !temNumero(t, somaTotal),
    exige: "admitir que a coluna não existe",
  },
  {
    finalidade: "report_analysis", nome: "filtro que não retorna nada",
    prompt: `${TABELA}\n\nQuantos colaboradores estão no departamento Jurídico?`,
    ok: (t) => /\b(zero|0|nenhum|não h[áa])\b/i.test(t), exige: "zero / nenhum",
  },

  // ── chat: fidelidade ao contexto ──────────────────────────────────────────
  {
    finalidade: "chat", nome: "responde e cita",
    prompt:
      `CONTEXTO:\n[1] Manual do RH — "Solicitação de férias": O colaborador deve solicitar as férias ` +
      `com no mínimo 45 dias de antecedência da data pretendida. A solicitação é feita no Painel do ` +
      `Colaborador, menu Férias.\n\nPergunta: Com quanta antecedência preciso pedir férias?`,
    ok: (t) => temNumero(t, 45) && /\[1\]/.test(t),
    exige: "45 dias + citação [1]",
  },
  {
    finalidade: "chat", nome: "número exato, sem arredondar",
    prompt:
      `CONTEXTO:\n[1] Manual do RH — "Adiantamento salarial": O adiantamento corresponde a 37,5% do ` +
      `salário base e é creditado no dia 18 de cada mês.\n\nPergunta: Qual o percentual do adiantamento?`,
    ok: (t) => temNumero(t, 37.5), exige: "37,5%",
  },
  {
    // A regra absoluta do sistema: sem contexto, não responde de memória.
    finalidade: "chat", nome: "CONTEXTO NÃO COBRE (não inventar)",
    prompt:
      `CONTEXTO:\n[1] Manual do RH — "Solicitação de férias": O colaborador solicita as férias no ` +
      `Painel do Colaborador, menu Férias.\n\nPergunta: Qual é a alíquota do INSS para quem ganha ` +
      `R$ 4.200 por mês?`,
    ok: (t) => RX_ADMITE.test(t) && !/\b(7,5|9|12|14)\s*%/.test(t),
    exige: "admitir que o contexto não traz",
  },
  {
    finalidade: "chat", nome: "não misturar manuais diferentes",
    prompt:
      `CONTEXTO:\n[1] Manual do OPERADOR — "Fechamento de folha": acesse Folha > Fechamento e clique ` +
      `em Processar.\n[2] Manual do COLABORADOR — "Holerite": acesse Painel do Colaborador > Holerite.` +
      `\n\nPergunta: Como eu vejo meu holerite?`,
    ok: (t) => /Painel do Colaborador/i.test(t) && !/Folha\s*>\s*Fechamento/i.test(t),
    exige: "usar só o manual do colaborador",
  },
];

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
    const [kind, ...r] = spec.split(":");
    const nome = r.join(":");
    const apiKey = porKind.get(kind!);
    if (!apiKey) throw new Error(`sem chave para "${kind}"`);
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

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) { console.error("Faltam credenciais do Supabase."); process.exit(1); }
  const db = createClient<Database>(url, chave, { auth: { persistSession: false } });
  const resolver = await montarProvedores(db);
  const sistema = `${PERSONA_RH}\n\n${REGRAS_ABSOLUTAS}`;

  const { data: precos } = await db.from("ai_model_prices").select("provider, model, input_usd_mtok, output_usd_mtok");
  const tabelaPrecos: Preco[] = (precos ?? []).map((p) => ({
    provider: p.provider, model: p.model, pin: Number(p.input_usd_mtok), pout: Number(p.output_usd_mtok), mr: 0.1, mw: 1,
  }));
  // O prompt destes casos carrega uma tabela de 40 linhas: ~3.000 tokens por caso.
  avisarCusto(MODELOS, CASOS.length, 3_000, tabelaPrecos);

  console.log(`\n${CASOS.length} casos verificáveis · ${MODELOS.length} modelos · sem juiz\n`);
  type P = { ok: number; n: number; ms: number; erros: number; falhou: string[] };
  const placar = new Map<string, P>(MODELOS.map((m) => [m, { ok: 0, n: 0, ms: 0, erros: 0, falhou: [] }]));

  for (const caso of CASOS) {
    process.stdout.write(`  ${caso.finalidade.padEnd(16)} ${caso.nome.padEnd(34)}`);
    for (const spec of MODELOS) {
      const p = placar.get(spec)!;
      const t0 = Date.now();
      try {
        const model = await resolver(spec);
        const r = await generateText({ model, system: sistema, prompt: caso.prompt, maxOutputTokens: 900 });
        p.ms += Date.now() - t0; p.n++;
        if (caso.ok(r.text ?? "")) { p.ok++; process.stdout.write("."); }
        else { p.falhou.push(caso.nome); process.stdout.write("x"); }
      } catch (e) {
        p.erros++; p.falhou.push(`${caso.nome} (erro)`); process.stdout.write("!");
        if (p.erros === 1) console.error(`\n    [${spec}] ${(e as Error).message.slice(0, 140)}`);
      }
    }
    console.log("");
  }

  const md: string[] = [`# Qualidade por finalidade — ${new Date().toISOString().slice(0, 16).replace("T", " ")}`, "",
    `${CASOS.length} casos de resposta VERIFICÁVEL (número conhecido, citação conferível). Sem juiz-modelo.`, "",
    "| modelo | acerto | s/caso | falhou em |", "|---|---|---|---|"];
  console.log("\n── PLACAR ".padEnd(86, "─"));
  console.log("  modelo                          acerto   s/caso   falhou em");
  const ordem = [...placar.entries()].sort((a, b) => b[1].ok - a[1].ok || a[1].ms - b[1].ms);
  for (const [spec, p] of ordem) {
    if (!p.n) { console.log(`  ${spec.padEnd(30)} — sem medição`); continue; }
    console.log(`  ${spec.padEnd(30)} ${`${p.ok}/${p.n}`.padStart(7)} ${(p.ms / p.n / 1000).toFixed(1).padStart(8)}   ${p.falhou.join(", ").slice(0, 52) || "—"}`);
    md.push(`| \`${spec}\` | ${p.ok}/${p.n} | ${(p.ms / p.n / 1000).toFixed(1)} | ${p.falhou.join(", ") || "—"} |`);
  }

  // Por finalidade — é a decisão que o dono precisa tomar, e ela é separada.
  for (const fin of ["report_analysis", "chat"] as const) {
    const doGrupo = CASOS.filter((c) => c.finalidade === fin);
    console.log(`\n── ${fin} (${doGrupo.length} casos) `.padEnd(86, "─"));
    md.push("", `## ${fin}`, "", "| modelo | acerto |", "|---|---|");
    const linhas = MODELOS.map((spec) => {
      const p = placar.get(spec)!;
      const falhas = doGrupo.filter((c) => p.falhou.includes(c.nome) || p.falhou.includes(`${c.nome} (erro)`)).length;
      return { spec, ok: doGrupo.length - falhas, tot: doGrupo.length };
    }).sort((a, b) => b.ok - a.ok);
    for (const l of linhas) {
      console.log(`  ${l.spec.padEnd(30)} ${l.ok}/${l.tot}`);
      md.push(`| \`${l.spec}\` | ${l.ok}/${l.tot} |`);
    }
  }

  const dir = SAIDA.slice(0, SAIDA.lastIndexOf("/"));
  if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(SAIDA, md.join("\n") + "\n", "utf8");
  console.log(`\nEscrito em ${SAIDA}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
