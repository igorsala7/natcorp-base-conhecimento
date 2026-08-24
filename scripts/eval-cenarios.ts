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
import { generateText, tool, stepCountIs, type ToolSet, type ModelMessage } from "ai";
import { z } from "zod";
import type { Database } from "../src/lib/database.types";
import { REGRAS_ABSOLUTAS, PERSONA_RH, resolveRegras } from "../src/lib/ai/prompt-cascade";
import { composeSystemPrompt } from "../src/lib/ai/system-prompt";
import { retrievePublicContext, buildContextBlock } from "../src/lib/ai/rag";
import { regraAgirOuPerguntar, regraNumerosExatos, regraMatriculaComFonte } from "../src/lib/chat/regras-nucleo";
import { integUsageDirective } from "../src/lib/chat/report-tools";
import { DIRETIVA_PERGUNTAR } from "../src/lib/ai/perguntar";
import { faltaPeriodoNaChamada, temSinalDePeriodo } from "../src/lib/chat/periodo";
import { faltaDestinoDaEntrega } from "../src/lib/chat/entrega";
import { decidirAcao } from "../src/lib/chat/portao-acao";
import { confirmaEmbalar } from "../src/lib/chat/portao-acao-confirma";
import { avisarCusto, totalGasto, type Preco } from "./custo-da-rodada";
import { simTools, listBaseTools } from "../src/lib/integrations/tool-catalog";
import { selecionarTopK } from "../src/lib/integrations/tool-narrow";
import { antecedenteDoTurno } from "../src/lib/chat/antecedente";
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
/**
 * ── `--funil`: MEDE A SELEÇÃO JUNTO COM A ESCOLHA ──────────────────────────
 *
 * Sem a flag (padrão), este eval reproduz `caso.ofertadas` — a lista que o funil
 * entregou NO DIA do turno. É deliberado: isola o MODELO da seleção, que é o que
 * permite dizer "o modelo errou" sem confundir com "a ferramenta não chegou".
 *
 * O preço disso apareceu em 24/08/2026: nenhum eval do projeto conseguia avaliar
 * uma mudança de FUNIL ponta a ponta. Baixar o piso `MIN_SEM` de 0,60 para 0,50
 * entrega +4 casos (medido em `eval:tools`) e põe 4 ferramentas a mais na mesa
 * (5,9 → 9,9) — e não havia como saber se isso melhora ou piora a ESCOLHA. O A/B
 * dava resultado idêntico byte a byte, porque a lista vinha do trace.
 *
 * Com `--funil`, as ferramentas de INTEGRAÇÃO são recomputadas agora, com o
 * código de hoje.
 *
 * ── A PRIMEIRA COISA QUE ELE MEDIU ─────────────────────────────────────────
 * O piso `MIN_SEM`, em 24/08/2026, duas repetições por braço, reprodução exata:
 *
 *              ferramenta   momento   tokens
 *   0,60 (hoje)   14/32      28/32     11.379
 *   0,50          14/32      27/32     12.144   (+6,7%)
 *
 * `eval:tools` dizia que baixar o piso entregava +4 casos (73→77 de 97). Ponta a
 * ponta o ganho NÃO APARECE: as ferramentas chegam à mesa e o modelo não as
 * converte. Custo real, benefício nenhum — a mudança ficou de fora.
 *
 * É a diferença que este modo existe para mostrar: ENTREGAR não é ESCOLHER, e
 * durante meses só havia instrumento para o primeiro. As LOCAIS são preservadas do caso: elas vêm do payload da
 * TELA, não do catálogo — recomputá-las mediria uma tela que não existe mais.
 */
const USAR_FUNIL = process.argv.includes("--funil");
/**
 * ── `--antecedente`: espelha o que a rota passou a mandar ao modelo ─────────
 *
 * A rota injeta, como bloco `dado_pergunta`, o assunto do turno anterior quando
 * `precisaContexto` (`route.ts:2518`, `antecedente.ts`). Sem espelhar aqui, a
 * mudança fica INVISÍVEL para a medição — o mesmo motivo pelo qual esta bancada
 * já espelha `portao-acao` e `portao-entrega`.
 *
 * A aproximação está declarada: a rota decide por `_gate.precisaContexto`, que
 * depende de sinais que o caso não guarda (`baseExclusiva`, `perguntaComposta`,
 * `modoRelatorioCedo`). Aqui o gatilho é o núcleo do predicado — histórico com
 * ≥2 falas do usuário E mensagem curta ou anafórica —, que é o que
 * `rewrite-gate.ts:37` de fato testa nos casos deste conjunto.
 */
const USAR_ANTECEDENTE = process.argv.includes("--antecedente");
/**
 * ── `--prompt-real`: monta pelo compositor da PRODUÇÃO ─────────────────────
 *
 * Sem a flag, a bancada usa a montagem histórica:
 *   [PERSONA_RH, REGRAS_ABSOLUTAS, integUsageDirective(), tela, DIRETIVA]
 *
 * Ela mede ~20% do que o modelo recebe (9.950 chars contra mediana de 49.694 em
 * produção) e — o que mais importa para a hipótese em teste — **em outra ordem**:
 * ali as REGRAS vêm ANTES da diretiva de ferramentas; em produção vêm DEPOIS, e
 * o CONTEXTO vem depois delas. A premissa do projeto é "o que vem por último
 * manda mais" (`prompt-cascade.ts:125`), então a bancada estava medindo o
 * arranjo oposto ao que se quer avaliar.
 *
 * Com a flag, usa `composeSystemPrompt` — a MESMA função da rota — com:
 *   persona → (especialização) → USO DAS FERRAMENTAS → REGRAS → CONTEXTO
 *
 * ── O QUE É FIEL E O QUE É APROXIMAÇÃO, declarado ─────────────────────────
 * FIEL: a ordem das seções, `resolveRegras` (que reanexa `regraRotulosColuna`,
 * 647 chars que a montagem antiga perdia), o núcleo de regras, e a cláusula
 * `RECONCILIACAO_FERRAMENTAS` quando há ferramenta de dados.
 *
 * APROXIMADO, e o viés é conhecido:
 *  · `capabilities` (o bloco que ENUNCIA a competição documentação × ferramenta)
 *    depende do catálogo do turno; aqui entra a diretiva de uso, que é o núcleo
 *    dele. Falta o `profileNote`, que é PII.
 *  · `blocoFormAssist` (até 18k chars) depende de `screenFields`, que o caso não
 *    guarda. Ausente. É o bloco que mais empurra a operar a TELA — logo o eval
 *    subestima a atração pela tela, e mudança que faça o modelo preferi-la vai
 *    parecer melhor aqui do que em produção.
 *  · a persona é a de fábrica; `widget_keys.system_prompt` é por chave e o trace
 *    não guarda a chave.
 *
 * ESPERE RESET DE LINHA DE BASE, NÃO GANHO. A primeira rodada com a flag produz
 * números que NÃO são comparáveis com nenhuma rodada anterior — igual ao que já
 * aconteceu quando as ferramentas locais passaram a ter a definição real.
 */
const PROMPT_REAL = process.argv.includes("--prompt-real");
/**
 * ── `--rag`: traz o lado da DOCUMENTAÇÃO, que nunca esteve na bancada ──────
 *
 * O gabarito tem `espera_fonte` em 138/138, e 52 casos (38%) esperam
 * documentação — sozinha ou combinada com ferramenta e tela. O eval nunca teve
 * bloco documental: pedia que o modelo respondesse pelo manual sem lhe dar o
 * manual. A hipótese central desta rodada é a COMPETIÇÃO entre manual e
 * ferramenta, e um dos dois lados simplesmente não existia.
 *
 * ── A DOSE VEM DO TURNO, não é fixa ───────────────────────────────────────
 * `rag_limite` e `rag_lexico` são gravados por `enriquecer-cenarios.ts` a partir
 * do `passo("rag")`. Medido no conjunto: a dose varia 0·1·2·3·4·6·8·18 — 41
 * casos receberam 8 trechos, 34 receberam 2, 7 receberam 18. E 66 rodaram
 * `lexicalOnly`, porque em modo relatório ou roteado a tool a produção PULA o
 * embedding. Recomputar com limite fixo, ou híbrido onde a produção foi léxica,
 * mediria uma competição que aquele turno nunca teve.
 *
 * ── O CORPUS PODE TER DERIVADO ────────────────────────────────────────────
 * O turno é de agosto e o corpus mudou (110 documentos entraram em 16/08). O
 * eval imprime quantas fontes vieram agora contra `rag_fontes` do trace: se
 * divergir muito, o caso está sendo julgado com outra documentação, e isso sai
 * no relatório em vez de ficar como suposição.
 *
 * Custo: 1 embedding por caso não-léxico, mais ~4.800 tok de entrada por turno
 * com documentação. Orçar 2 a 3× a rodada sem a flag.
 */
const USAR_RAG = process.argv.includes("--rag");
/**
 * ── `--fonte`: pontua DE ONDE a resposta veio ──────────────────────────────
 *
 * `espera_fonte` está preenchido em 138/138 e nunca foi pontuado. Distribuição:
 * tool 59 · tela+rag+tool 20 · tela 19 · rag 17 · tela+rag 13 · social 7 ·
 * rag+tool 2 · tela+tool 1.
 *
 * ── A RESSALVA QUE TORNA METADE DELE INÚTIL, e como contorno ───────────────
 * `extrair-cenarios.ts:188` faz `espera_fonte` cair no cenário OBSERVADO quando
 * não há anotação anterior, e `revisar` está zerado em 138/138. Medido: 52 casos
 * têm `espera_fonte === cenario` — indistinguíveis de "herdado sem ninguém
 * conferir". Pontuá-los faria o eixo PREMIAR O COMPORTAMENTO ATUAL por
 * construção, que é o defeito mais insidioso que uma régua pode ter.
 *
 * Regra adotada: divergir do cenário PROVA que alguém tocou; ser igual não prova
 * nada. Então o eixo pontua os 86 provados e reporta os 52 à parte, para o dono
 * conferir quando quiser. Nada de inventar confirmação.
 *
 * ── DOIS PASSOS, senão o eixo mede o lado errado ──────────────────────────
 * Detectar citação exige o TEXTO final, e num `generateText` de um passo o turno
 * que chama ferramenta não produz texto nenhum. Sem `stepCountIs(2)`, o eixo
 * documental só pontuaria quem NÃO chamou nada — exatamente o lado que não
 * interessa. A produção usa `stepCountIs(2)` no próprio caminho de rewrite, então
 * não é invenção; e continua NÃO sendo o `maxPassos` do laço real.
 *
 * ── O QUE ELE MEDIU NOS 138, e as duas leituras minhas que caem ───────────
 *
 *     exata 52/78 · faltou 26 · SOBROU 0
 *     quando faltou, o lado perdido: tool=10 · rag=9 · tela=8
 *
 * 1. Numa amostra de 20 o lado perdido era rag=3 · tool=2, e eu li como "a
 *    documentação vence a ferramenta" — coerente com a hipótese que eu vinha
 *    perseguindo. Nos 138 a perda é EQUILIBRADA. O agente não abandona uma
 *    fonte em favor de outra.
 * 2. `sobrou = 0` em 78 casos, e EU LI ISSO ERRADO — como "o agente nunca faz
 *    demais". Era propriedade do CONTADOR: o ramo de `faltou` vinha primeiro, e
 *    quem TROCOU de fonte (deixou a esperada, usou outra) caía nele. `sobrou=0`
 *    só provava que ninguém usou SUPERCONJUNTO ESTRITO. Corrigido: agora são
 *    três desfechos e a troca tem contador próprio.
 *
 * O defeito não é de PREFERÊNCIA entre fontes — é de SUBENTREGA uniforme, nos
 * três caminhos ao mesmo tempo. Bate com a razão 3,3:1 do gabarito.
 *
 * Consequência prática: empurrar o modelo da documentação para a ferramenta
 * TROCARIA DE BALDE sem reduzir o erro — e era exatamente o que a análise do
 * system prompt sugeria (mover a diretiva para a posição vencedora). Este número
 * desaconselha.
 *
 * Teto do eixo: 47 dos 125 não são pontuados porque `espera_fonte` herdou o
 * cenário e ninguém conferiu. Ele enxerga 62% do conjunto.
 */
const USAR_FONTE = process.argv.includes("--fonte");
/**
 * ── `--passos N`: quantos passos o modelo pode dar ────────────────────────
 *
 * A bancada rodava com UM passo (`generateText` sem `stopWhen`) e a producao usa
 * `stepCountIs(maxPassos)`, que e adaptativo — 3, 5, 6 ou 9 conforme o turno
 * (`route.ts`). Medido em 938 turnos instrumentados: a mediana real e de 2
 * passos, com folga media de 3,5 a 5,7.
 *
 * O que isso custou de leitura: entre a rodada de 1 passo e a de 2, o eixo de
 * FERRAMENTA subiu de 56 para 64 nos mesmos 125 casos. OITO casos que eu vinha
 * contando como "o modelo nao agiu" eram "a regua so deixou agir uma vez".
 *
 * Padrao 1 mantem o historico comparavel; `--fonte` sobe para 2 porque o eixo
 * documental precisa do TEXTO, que so existe depois do resultado voltar.
 */
const PASSOS = Number(arg("passos", USAR_FONTE ? "2" : "1"));
/**
 * O `espera_fonte` deste caso foi CONFERIDO por gente?
 *
 * `extrair-cenarios.ts:188` faz o campo herdar o cenário OBSERVADO quando não há
 * anotação anterior, e `revisar` está zerado em 138/138. Então:
 *   · DIVERGIR do cenário PROVA que alguém tocou — pontua;
 *   · ser IGUAL não prova nada — fica de fora e é reportado.
 *
 * Medido: 86 provados, 52 indeterminados. Pontuar os 52 faria o eixo premiar o
 * comportamento atual por construção, que é o pior defeito que uma régua pode ter.
 */
const fonteConferida = (c: { espera_fonte?: string | null; cenario?: string | null }): boolean =>
  !!c.espera_fonte && c.espera_fonte !== c.cenario;

/**
 * O CASO CARREGA O QUE O RÓTULO EXIGE?
 *
 * Medido em 24/08: dos 86 conferidos, 5 esperam TELA e o caso não tem tela
 * nenhuma (`tela: []`), e 3 esperam DOCUMENTAÇÃO num turno em que o RAG não
 * recuperou nada (`rag_fontes: 0`). São oito casos que o modelo NÃO TEM COMO
 * acertar — a fonte que o gabarito cobra não está no payload.
 *
 * Eles contavam como falha do agente e empurravam o eixo de tela para baixo: com
 * eles, "tela" acerta 42%; sem eles a leitura é outra. Régua que cobra o que não
 * entregou mede a própria lacuna e chama de defeito do medido.
 *
 * A causa é a extração, não a anotação: `extrair-cenarios.ts` grava `tela` a
 * partir do passo `dataset:registro`, que só existe quando o turno registrou
 * tabela — mas o dono rotulou olhando a CONVERSA, onde a tela estava visível.
 */
const casoTemAFonte = (c: {
  espera_fonte?: string | null;
  tela?: unknown[];
  rag_fontes?: number | null;
}): boolean => {
  const f = String(c.espera_fonte ?? "");
  if (f.includes("tela") && !(c.tela ?? []).length) return false;
  if (f.includes("rag") && !(c.rag_fontes ?? 0)) return false;
  return true;
};

/** Citou `[n]` que não existe entre as fontes entregues — defeito próprio. */
const citacaoInventada: string[] = [];
/** Qual LADO faltou quando a resposta usou menos fontes que o esperado. */
const faltaPorLado: Record<string, number> = {};
/** Qual TROCA foi feita — "esperado→usado". Diagnóstico diferente de falta. */
const trocaPorLado: Record<string, number> = {};
/** Casos em que a documentação de hoje diverge da que o turno recebeu. */
const derivaCorpus: string[] = [];
/** Falhas da recuperação — se sumirem em silêncio, o eixo documental mente. */
const erroRag: string[] = [];
const TOP_FUNIL = Number(arg("top", "12"));
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
  /** Cliente do turno. Preenchido por `enriquecer-cenarios.ts` a partir do trace. */
  base_code?: string | null;
  space_id?: string | null;
  /** A DOSE de documentação que o turno real recebeu — não é constante. */
  rag_limite?: number | null;
  rag_lexico?: boolean;
  /** Quantas fontes o turno real trouxe; serve para detectar deriva do corpus. */
  rag_fontes?: number | null;
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
    // SEM o filtro `active`, de propósito. Quem decide o que foi ofertado é o
    // `ofertadas` do caso — o turno real já aconteceu. O que se busca aqui é só
    // o TEXTO da ferramenta, e desativá-la depois não muda o que o modelo leu.
    //
    // Com o filtro, `bi_headcount`, `selecao_vagas` e `frequencia_justificativas`
    // — que têm descrição real (466/730/336 chars) e estão habilitadas na
    // natcorp — caíam no `?? key` e chegavam ao modelo como o próprio nome.
    // Mesmo defeito das ferramentas locais, por outro caminho.
    if (t?.key) catalogo.set(t.key, t);
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
    fonteMed: number; fonteExata: number; fonteFaltou: number; fonteSobrou: number; fonteTrocou: number;
    entrada: number; saida: number; erros: number; ms: number;
  };
  const placar = new Map<string, Placar>();
  for (const spec of MODELOS) {
    placar.set(spec, { tOk: 0, tMed: 0, pOk: 0, pMed: 0, perguntouDemais: 0, perguntouDeMenos: 0, fonteMed: 0, fonteExata: 0, fonteFaltou: 0, fonteSobrou: 0, fonteTrocou: 0, entrada: 0, saida: 0, erros: 0, ms: 0 });
  }
  const detalhe: { caso: Caso; por: Record<string, { usadas: string[]; perguntou: boolean; ok: boolean }> }[] = [];

  /** Placar de CADA repetição, para imprimir a faixa e não só a média. */
  const porRodada: { tOk: number; pOk: number; deMenos: number }[] = [];

  for (let rep = 0; rep < REPETICOES; rep++) {
   const marcaRep = { tOk: 0, pOk: 0, deMenos: 0 };
   // Catálogo da base, uma vez só — `--funil` precisa dele por caso.
  /**
   * CATÁLOGO POR CASO, não global.
   *
   * `--base natcorp` era aplicado a todos os 138. Medido em 24/08: 33 casos
   * (24%) são de OUTRO cliente — stefanini, leadec, incor, saude. Eles rodavam
   * contra o catálogo da natcorp, e isso vale para as simulações que já
   * aprovaram e reprovaram mudanças nesta e na sessão anterior.
   *
   * Cacheado por base: são 7 clientes em 138 casos, e `listBaseTools` bate no
   * banco a cada chamada.
   */
  const catalogoPorBase = new Map<string, Awaited<ReturnType<typeof listBaseTools>>>();
  const catalogoDe = async (b: string) => {
    if (!catalogoPorBase.has(b)) catalogoPorBase.set(b, await listBaseTools(db as never, b));
    return catalogoPorBase.get(b)!;
  };
  if (USAR_FUNIL) console.log(`--funil: recomputando a oferta de integração com o código de hoje (top ${TOP_FUNIL})\n`);

  for (const caso of amostra) {
    /**
     * A oferta EFETIVA deste turno. Sem `--funil` é a foto do trace; com a flag,
     * as de integração são decididas agora e as locais vêm do caso.
     */
    let ofertadasEfetivas = caso.ofertadas;
    if (USAR_FUNIL) {
      const baseDoCaso = (caso.base_code ?? BASE).trim().toLowerCase();
      const toolsDaBase = await catalogoDe(baseDoCaso);
      const sim = await simTools(db as never, baseDoCaso, caso.pergunta);
      const escolhidas = sim.size
        ? selecionarTopK(toolsDaBase as never, caso.pergunta, TOP_FUNIL, undefined, sim)
        : new Set<string>();
      ofertadasEfetivas = [...caso.ofertadas.filter(ehLocal), ...escolhidas];
    }
    const por: Record<string, { usadas: string[]; perguntou: boolean; ok: boolean }> = {};
    for (const spec of MODELOS) {
      const p = placar.get(spec)!;
      const chamadas: string[] = [];
      /**
       * OS ARGUMENTOS DA CHAMADA, não só o nome dela.
       *
       * Eram descartados (`execute: async () => { chamadas.push(key) }`), e com
       * eles se perdiam duas medições que o resto do sistema já espera:
       *   · `dados_de` — é o que distingue "usou a TELA" de "usou a API", e o
       *     eixo de FONTE não existe sem essa distinção;
       *   · o veredito `parametro_errado`, que `ai_tool_casos` aceita desde
       *     17/08 e que o eval nunca pôde produzir, porque não via parâmetro.
       *
       * Guardar não muda placar nenhum hoje. Destrava os dois.
       */
      const argsPorChamada: { tool: string; args: Record<string, unknown> }[] = [];
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
        ferramentas: ofertadasEfetivas,
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

      for (const key of ofertadasEfetivas) {
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
            execute: async (input: unknown) => { chamadas.push(key); argsPorChamada.push({ tool: key, args: (input ?? {}) as Record<string, unknown> }); return { ok: true }; },
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
          execute: async (input: unknown) => {
            // Mesma checagem do servidor: a ferramenta exige período e ninguém deu.
            if (faltaPeriodoNaChamada(t?.params, periodoInformado)) {
              barrouPorPeriodo = true;
              return { _erro: "PERÍODO NÃO INFORMADO" };
            }
            chamadas.push(key);
            argsPorChamada.push({ tool: key, args: (input ?? {}) as Record<string, unknown> });
            return { items: [{ ok: true }], _total: 1, _completo: true };
          },
        });
      }

      /**
       * A montagem HISTÓRICA fica como padrão para os relatórios já gravados
       * continuarem comparáveis; `--prompt-real` usa o compositor de produção.
       */
      // ── DOCUMENTAÇÃO DO TURNO ─────────────────────────────────────────
      let blocoRagDoCaso = "";
      if (USAR_RAG && caso.space_id && (caso.rag_limite ?? 0) > 0) {
        try {
          const fontes = await retrievePublicContext(
            caso.space_id,
            caso.pergunta,
            caso.rag_limite ?? 8,
            null,
            null,
            { lexicalOnly: caso.rag_lexico === true },
          );
          blocoRagDoCaso = buildContextBlock(fontes);
          // Deriva do corpus: o turno é de agosto e 110 documentos entraram em
          // 16/08. Divergência grande = o caso está sendo julgado com outra
          // documentação, e isso precisa sair no relatório, não virar suposição.
          const antes = caso.rag_fontes ?? 0;
          if (antes && Math.abs(fontes.length - antes) > Math.max(2, antes * 0.5)) {
            derivaCorpus.push(`${caso.pergunta.slice(0, 40)} — trouxe ${fontes.length}, o turno tinha ${antes}`);
          }
        } catch (e) {
          erroRag.push(`${caso.pergunta.slice(0, 40)}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      const temDataTools = Object.keys(tools).some((k) => ehLocal(k) && k !== "perguntar_ao_usuario");
      const sistema = PROMPT_REAL
        ? composeSystemPrompt(
            {
              persona: PERSONA_RH,
              // Os 3 do `blocoNucleo`, na ordem da rota (`regras-nucleo.ts`),
              // mais a diretiva de uso — que é o núcleo do `capabilities`.
              usoFerramentas: [
                regraAgirOuPerguntar(),
                regraNumerosExatos(),
                regraMatriculaComFonte(),
                integUsageDirective(),
              ].filter(Boolean).join("\n\n"),
              regras: resolveRegras(null),
              comTools: temDataTools,
            },
            // O CONTEXTO da produção traz RAG + tela. Aqui só a tela existe; o
            // RAG entra quando `--rag` for construído. Enquanto isso, o bloco
            // documental está AUSENTE e os 52 casos que o esperam não são
            // julgáveis — está dito no cabeçalho da flag.
            [blocoRagDoCaso, blocoDaTela(caso.tela)].filter(Boolean).join("\n\n") ||
              "(sem contexto recuperado neste turno)",
          ) + (DIRETIVA ? `\n\n${DIRETIVA_PERGUNTAR}` : "")
        : [PERSONA_RH, REGRAS_ABSOLUTAS, integUsageDirective(), blocoDaTela(caso.tela), DIRETIVA ? DIRETIVA_PERGUNTAR : ""]
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
      // Espelho do bloco `antecedente` da rota: prefixado à ÚLTIMA mensagem,
      // exatamente como `comDadosNaUltimaPergunta` faz em produção.
      if (USAR_ANTECEDENTE) {
        const falasDoUsuario = caso.historico.filter((h) => h.role === "user").length;
        const palavras = caso.pergunta.trim().split(/\s+/).length;
        const curtaOuAnafora = palavras <= 6 || /\b(dele|dela|deles|delas|isso|esse|essa|esses|essas|mesmo|ai|la)\b/i.test(caso.pergunta);
        if (falasDoUsuario >= 1 && curtaOuAnafora) {
          const bloco = antecedenteDoTurno(caso.pergunta, messages as { role: string; content: string }[]);
          if (bloco) {
            const i = messages.length - 1;
            messages[i] = { role: "user", content: `${bloco}\n\n---\n\n${caso.pergunta}` };
          }
        }
      }

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
        const r = await generateText({
          model, system: sistema, messages, tools, maxOutputTokens: 700, temperature: 0,
          // Um passo mede a DECISÃO; mais passos medem o TURNO. A produção dá
          // 3 a 9 — ver o comentário de `--passos`.
          ...(PASSOS > 1 ? { stopWhen: stepCountIs(PASSOS) } : {}),
        });
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

        // ── FONTE: de ONDE a resposta veio ────────────────────────────────
        if (USAR_FONTE && fonteConferida(caso) && casoTemAFonte(caso)) {
          const esperado = new Set(String(caso.espera_fonte ?? "").split("+").map((x) => x.trim()).filter(Boolean));
          const obtido = new Set<string>();
          // DOCUMENTAÇÃO: citação [n] válida. `[7]` com 4 fontes é citação
          // INVENTADA — conta como defeito próprio, não como uso da doc.
          const nFontes = (blocoRagDoCaso.match(/^\[\d+\]/gm) ?? []).length;
          const citados = [...String(r.text ?? "").matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
          if (citados.some((n) => n >= 1 && n <= nFontes)) obtido.add("rag");
          if (nFontes && citados.some((n) => n > nFontes)) citacaoInventada.push(caso.pergunta.slice(0, 44));
          // TELA: ferramenta local com `dados_de` apontando para um dataset da
          // tela. Só é detectável porque os ARGUMENTOS passaram a ser guardados.
          if (argsPorChamada.some((c) => /^tela|^ds/i.test(String(c.args?.dados_de ?? "")))) obtido.add("tela");
          // FERRAMENTA: chamada de integração.
          if (usadas.some((k) => !ehLocal(k))) obtido.add("tool");
          if (esperado.has("social")) {
            // Esperado = nada: acerto é não citar e não chamar.
            if (!obtido.size) p.fonteExata++; else p.fonteSobrou++;
          } else {
            const faltou = [...esperado].filter((x) => !obtido.has(x));
            const sobrou = [...obtido].filter((x) => !esperado.has(x));
            /**
             * TRÊS DESFECHOS, NÃO DOIS — e a versão anterior os misturava.
             *
             * O ramo de `faltou` vinha PRIMEIRO, então um turno que TROCOU de
             * fonte (deixou a esperada e usou outra) tinha os dois conjuntos
             * preenchidos e era contado só como falta. `sobrou = 0` provava
             * apenas que ninguém usou um SUPERCONJUNTO ESTRITO — e eu li isso
             * como "o agente nunca faz demais, só de menos", que é conclusão
             * sobre o AGENTE tirada de propriedade do CONTADOR.
             *
             * Trocar é diagnóstico próprio: quem responde "Me ensina a usar"
             * chamando `tutorial_tela` em vez da documentação não subentregou —
             * foi para a fonte errada. Misturar os dois esconde exatamente a
             * diferença entre "agiu de menos" e "agiu no lugar errado".
             */
            if (!faltou.length && !sobrou.length) p.fonteExata++;
            else if (faltou.length && sobrou.length) {
              p.fonteTrocou++;
              for (const f of faltou) trocaPorLado[`${f}→${sobrou.join("/")}`] = (trocaPorLado[`${f}→${sobrou.join("/")}`] ?? 0) + 1;
            } else if (faltou.length) {
              p.fonteFaltou++;
              for (const f of faltou) faltaPorLado[f] = (faltaPorLado[f] ?? 0) + 1;
            } else p.fonteSobrou++;
          }
          p.fonteMed++;
        }

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
  if (USAR_FONTE) {
    const p0 = [...placar.values()][0];
    const conferidos = amostra.filter(fonteConferida).length;
    console.log(`\n── FONTE ` + "─".repeat(53));
    console.log(`  conferidos (espera_fonte ≠ cenário observado): ${conferidos} de ${amostra.length}`);
    const impossiveis = amostra.filter((c) => fonteConferida(c) && !casoTemAFonte(c)).length;
    console.log(`  os outros ${amostra.length - conferidos} herdaram o cenário e NÃO são pontuados —`);
    console.log(`  pontuá-los premiaria o comportamento atual por construção.`);
    if (impossiveis) {
      console.log(`  ${impossiveis} conferidos ficam de fora por IMPOSSIBILIDADE: o rótulo cobra tela`);
      console.log(`  ou documentação que o CASO não carrega. Régua que cobra o que não entregou`);
      console.log(`  mede a própria lacuna e chama de defeito do medido.`);
    }
    if (p0?.fonteMed) {
      console.log(`\n  exata ${p0.fonteExata}/${p0.fonteMed} · faltou ${p0.fonteFaltou} · TROCOU ${p0.fonteTrocou} · sobrou ${p0.fonteSobrou}`);
      const trocas = Object.entries(trocaPorLado).sort((a, b) => b[1] - a[1]).slice(0, 5);
      if (trocas.length) console.log(`  trocas mais comuns: ${trocas.map(([k, n]) => `${k} (${n})`).join(" · ")}`);
      const lados = Object.entries(faltaPorLado).sort((a, b) => b[1] - a[1]);
      // Qual LADO perde é o número que testa a hipótese: nos casos que esperam
      // documentação E ferramenta, o agente larga qual dos dois? A média
      // apagaria justamente isso.
      if (lados.length) console.log(`  quando faltou, o lado perdido foi: ${lados.map(([k, n]) => `${k}=${n}`).join(" · ")}`);
    }
    if (citacaoInventada.length) {
      console.log(`  ⚠ ${citacaoInventada.length} com CITAÇÃO INVENTADA (citou [n] fora das fontes entregues)`);
      for (const c of citacaoInventada.slice(0, 3)) console.log(`     ${c}`);
    }
    console.log();
  }
  if (USAR_RAG) {
    const comDoc = amostra.filter((c) => (c.rag_limite ?? 0) > 0).length;
    console.log(`\n── DOCUMENTAÇÃO ` + "─".repeat(46));
    console.log(`  casos com documentação recuperada: ${comDoc} de ${amostra.length}`);
    if (derivaCorpus.length) {
      console.log(`  ⚠ ${derivaCorpus.length} com DERIVA do corpus (julgados com outra documentação):`);
      for (const d of derivaCorpus.slice(0, 5)) console.log(`     ${d}`);
    }
    if (erroRag.length) {
      console.log(`  ⚠ ${erroRag.length} falha(s) na recuperação:`);
      for (const e of erroRag.slice(0, 3)) console.log(`     ${e}`);
    }
    console.log();
  }
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
