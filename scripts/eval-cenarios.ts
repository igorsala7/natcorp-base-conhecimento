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
import { familiaDaTool } from "../src/lib/chat/tool-trace";
import { generateText, tool, type ToolSet, type ModelMessage } from "ai";
import { z } from "zod";
import type { Database } from "../src/lib/database.types";
import { REGRAS_ABSOLUTAS, PERSONA_RH } from "../src/lib/ai/prompt-cascade";
import { integUsageDirective } from "../src/lib/chat/report-tools";
import { DIRETIVA_PERGUNTAR } from "../src/lib/ai/perguntar";
import { faltaPeriodoNaChamada, temSinalDePeriodo } from "../src/lib/chat/periodo";
import { faltaDestinoDaEntrega } from "../src/lib/chat/entrega";
import { decidirAcao } from "../src/lib/chat/portao-acao";
import { confirmaEmbalar } from "../src/lib/chat/portao-acao-confirma";
import { avisarCusto, totalGasto, type Preco } from "./custo-da-rodada";
import { buildQueryTool } from "../src/lib/chat/query-tools";
import { buildFormTools, buildTutorialTool } from "../src/lib/chat/form-fields";
import { buildVisualTools } from "../src/lib/chat/report-tools";

/**
 * AS FERRAMENTAS LOCAIS, COM A DEFINIÇÃO REAL DO PRODUTO.
 *
 * `consultar_registros`, `agrupar`, `preencher_campo` e as outras não existem
 * em `ai_tools` — são montadas em código a partir do payload da tela. O arreio
 * as recriava a partir do catálogo do banco, não achava, e entregava ao modelo
 * o NOME da ferramenta como descrição.
 *
 * Aqui elas são construídas pelos builders DE PRODUÇÃO, com sinks vazios: o
 * que interessa é `description` e `inputSchema`, que é o que o modelo lê para
 * decidir. O `execute` é trocado por um registrador — este arreio mede ESCOLHA,
 * não execução.
 *
 * Passar `fields: []` deixa o schema de `preencher_campo` genérico, porque o
 * trace não guarda os campos da tela. É menos fiel que a produção e mais fiel
 * que uma palavra solta; onde isso pesar, o caso é de anotação, não de placar.
 */
const LOCAIS_REAIS: Record<string, { description: string; inputSchema: unknown }> = (() => {
  const registry = { list: [] as never[] };
  const juntar = (ts: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(ts)) {
      const d = v as { description?: string; inputSchema?: unknown };
      if (d?.description && d.inputSchema) out[k] = { description: d.description, inputSchema: d.inputSchema };
    }
  };
  const out: Record<string, { description: string; inputSchema: unknown }> = {};
  try {
    juntar(buildQueryTool(registry as never) as never);
    juntar(buildFormTools([], []) as never);
    juntar(buildTutorialTool([], []) as never);
    juntar(buildVisualTools({ charts: [], reports: [] }, registry as never) as never);
  } catch (e) {
    console.error("[eval] não consegui montar as ferramentas locais reais:", e);
  }
  return out;
})();

if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === "undefined") {
  const { WebSocket } = await import("ws");
  (globalThis as { WebSocket?: unknown }).WebSocket = WebSocket;
}

const arg = (nome: string, padrao: string): string => {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : padrao;
};
/**
 * Quantos casos entram no placar. Era 99 — de um conjunto que cresceu para 130.
 *
 * O corte é um `.slice(0, N)` DEPOIS de tirar os de funil, então os 19 últimos
 * casos com gabarito nunca eram medidos. Entre eles estava o idx 113 ("Quais
 * são os dados do Tony Oliveira?"), o único que teria pegado a regressão de uma
 * proposta de descrição avaliada em 23/08/2026 — a rodada padrão do projeto
 * aprovaria a mudança sem ver o caso que ela quebrava.
 *
 * Amostra que esconde o contraexemplo não é amostra, é seleção. Mede tudo; o
 * `--n` continua existindo para rodada rápida de conferência.
 */
const N = Number(arg("n", "0")) || Number.MAX_SAFE_INTEGER;
/**
 * LOCAL x INTEGRAÇÃO pela fonte canônica (`familiaDaTool`), não por uma lista
 * copiada: duas listas divergem, e a divergência aparece como defeito
 * fantasma no placar. Tudo que não é "integracao" é local.
 */
const ehLocal = (chave: string): boolean => familiaDaTool(chave) !== "integracao";

const BASE = arg("base", "natcorp");
const ARQUIVO = arg("casos", "eval/cenarios.jsonl");
const SAIDA = arg("saida", "eval/cenarios.md");
// `--diretiva 1` acrescenta DIRETIVA_PERGUNTAR ao prompt. Existe para medir a
// diretiva A/B no MESMO conjunto antes de ela entrar na produção — mudar prompt
// sem antes/depois é o erro que este eval existe para não repetir.
const DIRETIVA = arg("diretiva", "0") === "1";
// `--sem-portao-entrega 1` desliga o espelho do portão de `entrega.ts`. Existe
// pelo mesmo motivo de `--diretiva`: medir A/B no MESMO conjunto, sem editar
// código entre as duas rodadas — o jeito mais fácil de comparar duas coisas
// diferentes achando que são a mesma.
const SEM_PORTAO_ENTREGA = arg("sem-portao-entrega", "0") === "1";
/** `--sem-portao-acao 1` desliga o espelho do portão de ação, para o A/B. */
const SEM_PORTAO_ACAO = arg("sem-portao-acao", "0") === "1";
/**
 * REPETIÇÕES. Medido em 21/08/2026: `temperature: 0` NÃO torna a rodada
 * determinística — quatro execuções idênticas deram 41, 43, 44 e 44 no eixo de
 * ferramenta. Provedor não é bit-determinístico (lote, hardware, roteamento
 * interno), e o eixo de ferramenta é o que mais sente, porque a decisão entre
 * ferramentas parecidas se dá por margens minúsculas.
 *
 * Sem repetir, uma diferença de 2 casos parece efeito e é acaso — e foi o que
 * quase me fez creditar ao portão de entrega um ganho que era ruído. Com N>1 o
 * placar imprime a FAIXA, e conclusão só vale fora dela.
 */
const REPETICOES = Math.max(1, Number(arg("repeticoes", "1")));
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
  /** Quando o turno original aconteceu — é a IDADE da foto de `ofertadas`. */
  foi_em?: string | null;
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
    // A frase anterior era "use as ferramentas de consulta para lê-las" — uma
    // ordem INCONDICIONAL, escrita pelo próprio arreio, presente em 43 dos 99
    // casos pontuados. Ela mandava chamar e o gabarito depois punia a chamada:
    // 8 das 11 chamadas erradas de `consultar_registros` caíam nesses turnos.
    //
    // O conserto NÃO é esvaziar. Produção instrui MAIS, não menos
    // (`screenTablesBlock`, form-fields.ts:629-632) — só que CONDICIONALMENTE:
    // a prévia serve para ANALISAR, e a ferramenta serve para FILTRAR/CONTAR.
    // Medido: tirar todo o empurrão dá +10/129 no agregado mas REGRIDE 4 casos,
    // e os 4 são exatamente os de filtrar/contar/exportar — onde produção tem a
    // diretiva que o esvaziamento removeria. Um arreio sem células E sem
    // orientação é um estado que produção nunca tem.
    //
    // Daí a redação abaixo: a mesma divisão condicional de produção, com a
    // ressalva honesta de que aqui as células não existem (o trace não as
    // guarda). Isto é RESET DE LINHA DE BASE, não ganho — nenhum cliente vê
    // diferença; só a régua mudou. Comparar com rodada anterior a 23/08/2026 é
    // comparar réguas diferentes.
    "(o conteúdo das células não está neste contexto de avaliação — em produção o modelo recebe uma PRÉVIA das linhas)",
    "Para ANALISAR/interpretar o que está na tabela, responda pela própria tabela. Para FILTRAR ou CONTAR um recorte " +
      '("só os que...", "quantos têm X"), a conta pela prévia é PARCIAL — aí sim use a ferramenta de consulta com dados_de.',
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
  //
  // Só vale para ferramenta de INTEGRAÇÃO. As LOCAIS (preencher_campo,
  // consultar_registros, gerar_relatorio…) não passam por top-K: elas dependem
  // do que o widget mandou na tela e das regras do turno. Chamar a ausência
  // delas de "falha de funil" manda procurar no lugar errado — em 21/08/2026
  // isso me fez caçar três defeitos de `preencher_campo` que já estavam
  // consertados (o guarda `operandoATela`, de 19/08), porque o `ofertadas` do
  // caso é uma FOTO do turno original, não o funil de hoje.
  const doFunil = todos.filter(
    (c) => !c.revisar && c.espera_tool && !ehLocal(c.espera_tool) && !c.ofertadas.includes(c.espera_tool),
  );
  // Local ausente: fica NO placar (o modelo até poderia ter agido de outro
  // jeito), mas sai rotulado — a correção é no payload da tela, não na seleção.
  const localAusente = todos.filter(
    (c) => !c.revisar && c.espera_tool && ehLocal(c.espera_tool) && !c.ofertadas.includes(c.espera_tool),
  );
  const amostra = todos.filter((c) => !c.revisar && !doFunil.includes(c)).slice(0, N);

  // A FOTO ENVELHECE. `ofertadas` foi gravado no dia do turno; o funil mudou
  // desde então. Sem este aviso, um caso antigo continua acusando um defeito já
  // corrigido, e o placar mente para menos.
  const idade = (c: Caso) => (c.foi_em ? (Date.now() - new Date(c.foi_em).getTime()) / 86_400_000 : 0);
  const velhos = [...doFunil, ...localAusente].filter((c) => idade(c) > 5);
  if (velhos.length) {
    console.log(`\n⚠ ${velhos.length} caso(s) com a lista de ferramentas capturada há mais de 5 dias:`);
    for (const c of velhos) {
      console.log(`   ${Math.round(idade(c))}d  ${c.espera_tool}  "${c.pergunta.slice(0, 44)}"`);
    }
    console.log("  Confira se o defeito ainda existe antes de consertá-lo — o funil pode já ter mudado.");
  }
  if (localAusente.length) {
    console.log(`\n${localAusente.length} caso(s) com ferramenta LOCAL ausente (corrige-se no payload da tela, não na seleção):`);
    for (const c of localAusente) console.log(`   ${c.espera_tool}  "${c.pergunta.slice(0, 48)}"`);
  }

  // Declara o custo ANTES de gastar — ver custo-da-rodada.ts.
  const tabelaPrecos: Preco[] = (precos ?? []).map((p) => ({
    provider: p.provider, model: p.model, pin: Number(p.input_usd_mtok), pout: Number(p.output_usd_mtok), mr: 0.1, mw: 1,
  }));
  avisarCusto(MODELOS, Math.min(todos.filter((c) => !c.revisar).length, N), 11_000, tabelaPrecos);

  console.log(`\n${amostra.length} casos medíveis · ${MODELOS.length} modelos`);
  if (semGabarito.length) console.log(`${semGabarito.length} ainda sem gabarito — fora do placar`);
  if (doFunil.length) console.log(`${doFunil.length} são falha de FUNIL (a ferramenta certa não chegou ao modelo) — fora do placar`);
  console.log(`mesmo histórico, mesma tela, mesmas ferramentas — só o modelo muda${DIRETIVA ? "\nCOM a diretiva de perguntar" : ""}\n`);

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

  /** Placar de CADA repetição, para imprimir a faixa e não só a média. */
  const porRodada: { tOk: number; pOk: number; deMenos: number }[] = [];

  for (let rep = 0; rep < REPETICOES; rep++) {
   const marcaRep = { tOk: 0, pOk: 0, deMenos: 0 };
   for (const caso of amostra) {
    const por: Record<string, { usadas: string[]; perguntou: boolean; ok: boolean }> = {};
    for (const spec of MODELOS) {
      const p = placar.get(spec)!;
      const chamadas: string[] = [];
      const tools: ToolSet = {};
      /**
       * O mesmo FATO que a rota calcula: a PESSOA disse algum período? Reproduzido
       * aqui para que a checagem de período do `execute` valha no eval — sem ela o
       * eval mediria um pipeline que a produção não tem.
       */
      const periodoInformado =
        temSinalDePeriodo(caso.pergunta) ||
        temSinalDePeriodo(caso.historico.filter((h) => h.role === "user").slice(-3).map((h) => h.content).join(" "));
      let barrouPorPeriodo = false;

      /**
       * PORTÃO DE AÇÃO, espelhado do servidor (`portao-acao.ts` + `-confirma`).
       *
       * Na rota ele age via `toolChoice` no passo 0: o provedor RETIRA do modelo
       * a opção de não chamar. Aqui o efeito é o mesmo — a ferramenta conta como
       * chamada, porque foi isso que o usuário recebeu. Sem este espelho, um
       * portão que funciona em produção não moveria o placar.
       *
       * As DUAS etapas são espelhadas, inclusive a confirmação semântica: medir
       * só o pré-filtro mediria um sistema mais afoito do que o que roda.
       */
      const ultimaAssist = [...caso.historico].reverse().find((h) => h.role === "assistant")?.content;
      const _pre = SEM_PORTAO_ACAO ? { modo: "livre" as const } : decidirAcao({
        pergunta: caso.pergunta,
        ferramentas: caso.ofertadas,
        conversaEmAndamento: caso.historico.length > 0,
        social: false, tutorial: false, documental: false, continuation: false,
      });
      let acaoForcadaEval: string | null = null;
      if (_pre.modo === "forcar") {
        const conf = await confirmaEmbalar(caso.pergunta, ultimaAssist);
        if (!conf.indefinido && conf.embalar) acaoForcadaEval = _pre.tool;
      }

      /**
       * PORTÃO DE ENTREGA, espelhado do servidor (`entrega.ts`).
       *
       * O servidor decide ANTES do modelo — o turno nem chega a gerar. Aqui o
       * efeito é o mesmo: se o portão dispararia, o turno conta como PERGUNTOU,
       * porque foi isso que o usuário veria. Sem este espelho, um portão que
       * funciona em produção não moveria o placar, e a medição diria que a
       * correção não serviu.
       */
      const linhasEmJogo = caso.tela.reduce((m, t) => Math.max(m, t.linhas ?? 0), 0);
      const barrouPorEntrega = faltaDestinoDaEntrega(caso.pergunta, linhasEmJogo);

      // A pergunta é uma ferramenta: medível pelo mesmo caminho da decisão.
      tools.perguntar_ao_usuario = tool({
        description:
          "Use APENAS quando faltar algo que MUDA o resultado e não dá para deduzir do histórico nem da tela. " +
          "Não use para pedido óbvio, mensagem curta com contexto claro, ou repetição do que já foi pedido.",
        inputSchema: z.object({ pergunta: z.string(), opcoes: z.array(z.string()).optional() }),
        execute: async () => { chamadas.push("perguntar_ao_usuario"); return { aguardando: true }; },
      });

      for (const key of caso.ofertadas) {
        // FERRAMENTA LOCAL: a definição REAL, importada do produto.
        //
        // `catalogo` vem de `ai_tools`, e nenhuma local existe lá — então o
        // ramo abaixo caía no `?? key` e entregava ao modelo a string
        // "consultar_registros" (19 chars) no lugar dos 719 reais, com
        // inputSchema VAZIO. Medido em 23/08/2026: acontecia em 94 dos 118
        // casos mensuráveis, e as locais são 8 das 11 ferramentas mais
        // chamadas erradamente no placar. Cobrar do modelo uma escolha que ele
        // fez com uma palavra e nenhum parâmetro mede o arreio, não o produto.
        const real = LOCAIS_REAIS[key];
        if (real) {
          tools[key] = tool({
            description: real.description,
            inputSchema: real.inputSchema,
            execute: async () => { chamadas.push(key); return { ok: true }; },
          } as never);
          continue;
        }
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
          execute: async () => {
            // Mesma checagem do servidor: a ferramenta exige período e ninguém deu.
            if (faltaPeriodoNaChamada(t?.params, periodoInformado)) {
              barrouPorPeriodo = true;
              return { _erro: "PERÍODO NÃO INFORMADO" };
            }
            chamadas.push(key);
            return { items: [{ ok: true }], _total: 1, _completo: true };
          },
        });
      }

      const sistema = [PERSONA_RH, REGRAS_ABSOLUTAS, integUsageDirective(), blocoDaTela(caso.tela), DIRETIVA ? DIRETIVA_PERGUNTAR : ""]
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
        /**
         * TEMPERATURA ZERO, e isso é decisão de instrumento, não de fidelidade.
         *
         * Sem fixá-la, o provedor usa o padrão (1.0) e o placar oscila SOZINHO.
         * Medido em 21/08/2026, três rodadas do mesmo modelo sobre os mesmos 51
         * casos: ferramenta 31, 28 e 29 — as duas últimas com código idêntico.
         * Um eval cuja variação própria é de 2 a 3 casos não consegue julgar uma
         * correção que move 1, e foi exatamente o que quase aconteceu: o portão
         * de entrega pareceu DERRUBAR o eixo de ferramenta, e a repetição
         * mostrou que era ruído.
         *
         * Produção roda no padrão, então isto mede um sistema levemente
         * diferente. É o preço certo a pagar: um portão de regressão precisa
         * distinguir sinal de acaso, e essa é a única propriedade que ele não
         * pode negociar. O eixo PERGUNTA, aliás, já vinha estável nas três
         * rodadas (41, 42, 42) — o ruído mora na escolha entre ferramentas
         * parecidas, que é onde a temperatura pesa.
         */
        const r = await generateText({ model, system: sistema, messages, tools, maxOutputTokens: 700, temperature: 0 });
        p.ms += Date.now() - t0;
        p.entrada += r.usage?.inputTokens ?? 0;
        p.saida += r.usage?.outputTokens ?? 0;

        // Barrar por período É o sistema perguntando — o modelo recebe as opções e
        // repassa. Contar diferente esconderia justamente o que a checagem faz.
        const entregaBarrou = SEM_PORTAO_ENTREGA ? false : barrouPorEntrega;
        const perguntou = chamadas.includes("perguntar_ao_usuario") || barrouPorPeriodo || entregaBarrou;
        /**
         * O portão de ENTREGA encurta o turno no servidor: ele responde a
         * pergunta e RETORNA, antes de o modelo existir. Marcar só "perguntou" e
         * deixar as ferramentas do modelo contarem mediria um turno híbrido que
         * não acontece em lugar nenhum — e foi assim que o portão apareceu
         * custando um caso no eixo de ferramenta que ele não custa.
         *
         * O de PERÍODO é diferente e continua contando: ele age no `execute` da
         * ferramenta, então a chamada de fato aconteceu e a escolha foi feita.
         */
        // A forçada CONTA como chamada: em produção o provedor a executa no passo 0.
        const base = entregaBarrou ? [] : chamadas.filter((c) => c !== "perguntar_ao_usuario");
        const usadas = acaoForcadaEval && !base.includes(acaoForcadaEval) ? [acaoForcadaEval, ...base] : base;

        // FERRAMENTA — `espera_tool: null` significa "nenhuma ferramenta de dado".
        p.tMed++;
        const tOk = caso.espera_tool ? usadas.includes(caso.espera_tool) : usadas.length === 0;
        if (tOk) { p.tOk++; marcaRep.tOk++; }

        // PERGUNTA — os dois lados contam, e cada erro tem nome próprio.
        p.pMed++;
        if (perguntou === caso.espera_clarify) { p.pOk++; marcaRep.pOk++; }
        else if (perguntou) p.perguntouDemais++;
        else { p.perguntouDeMenos++; marcaRep.deMenos++; }

        por[spec] = { usadas, perguntou, ok: tOk && perguntou === caso.espera_clarify };
      } catch (e) {
        p.erros++;
        por[spec] = { usadas: [`ERRO: ${(e as Error).message.slice(0, 40)}`], perguntou: false, ok: false };
        if (p.erros === 1) console.error(`  [${spec}] ${(e as Error).message.slice(0, 200)}`);
      }
    }
    const acertos = new Set(Object.values(por).map((v) => v.ok));
    // Só a PRIMEIRA repetição alimenta a lista de falhas: repetir encheria o
    // relatório com o mesmo caso N vezes e esconderia quantos distintos falham.
    if (rep === 0 && (acertos.size > 1 || !acertos.has(true))) detalhe.push({ caso, por });
    process.stdout.write(".");
   }
   porRodada.push(marcaRep);
   if (REPETICOES > 1) process.stdout.write(` [${rep + 1}/${REPETICOES}]`);
  }
  console.log("\n");

  if (REPETICOES > 1) {
    const faixa = (v: number[]) => `${Math.min(...v)}–${Math.max(...v)}`;
    console.log(
      `  FAIXA em ${REPETICOES} repetições — ferramenta ${faixa(porRodada.map((r) => r.tOk))} · ` +
      `pergunta ${faixa(porRodada.map((r) => r.pOk))} · de menos ${faixa(porRodada.map((r) => r.deMenos))}`,
    );
    console.log("  Conclusão só vale FORA desta faixa: dentro dela é acaso do provedor, não efeito.\n");
  }

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

  const gasto = totalGasto(
    [...placar.entries()].map(([spec, p]) => ({ spec, entrada: p.entrada, saida: p.saida })),
    tabelaPrecos,
  );
  console.log(`\n  GASTO REAL DESTA RODADA: US$ ${gasto.toFixed(2)}`);
  md.push("", `**Gasto real desta rodada:** US$ ${gasto.toFixed(2)}.`, "");

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
