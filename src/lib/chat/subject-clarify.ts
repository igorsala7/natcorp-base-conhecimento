import "server-only";
import { z } from "zod";
import type { UsageMeta } from "@/lib/ai/config";

/**
 * Desambiguação de SUJEITO/REFERENTE por histórico (anáfora).
 *
 * Quando a mensagem NÃO nomeia quem/o quê ("qual o salário dele?", "e a matrícula?",
 * "quanto ganham?", "detalha esses") MAS a conversa vinha tratando de colaboradores/
 * itens LISTADOS — ou há um relatório na tela — confirmamos o referente antes de
 * responder (pessoas listadas × resultados do relatório × consulta geral). Se NÃO há
 * candidato algum no contexto, NÃO pergunta.
 *
 * Custo controlado: um PRÉ-FILTRO regex barato decide se vale rodar o classificador
 * LLM (modelo `query_rewrite`) — que só entra no subconjunto "parece anáfora + há
 * contexto".
 */

export type ClarifyMsg = { role: string; content: string };

/** Marcadores anafóricos: a mensagem refere algo/alguém NÃO nomeado nela. */
const RX_ANAFORA =
  /\b(ele|ela|eles|elas|dele|dela|deles|delas|nele|nela|neles|nelas|lhe|lhes)\b|\b[oa]s?\s+(primeir|segund|terceir|quart|quint|[uú]ltim)[oa]s?\b|^\s*e\s+[oa]s?\b|\b(ess[ae]s?|dess[ae]s?|ness[ae]s?|aquel[ea]s?)\b/i;

/**
 * DESCRIÇÃO DEFINIDA — "os dados", "a tabela", "o relatório", "essa tela".
 *
 * Gramaticalmente não é anáfora: não há pronome nem demonstrativo, então
 * `RX_ANAFORA` não pega. E não deveria pegar em geral — "analise os dados" na
 * tela em que a pessoa está há dez minutos não tem ambiguidade nenhuma:
 * "os dados" são os da tela, e perguntar seria burocracia.
 *
 * O que muda tudo é a TROCA DE TELA. Relatado pelo Igor (16/08/2026): estava
 * conversando sobre um colaborador numa tela sem relatório, foi para uma tela
 * COM relatório e pediu para avaliar os dados — o chat avaliou o colaborador.
 * A frase não mudou; o mundo em volta dela mudou, e passou a ter dois
 * candidatos: a tela nova e o assunto em curso.
 *
 * Por isso esta lista só vale acompanhada de `mudouTela`. É a troca de tela que
 * transforma uma frase clara em ambígua — sozinha, a lista dispararia o tempo
 * todo e a confirmação viraria ruído.
 */
const RX_REFERENCIA_VAGA =
  /\b(os\s+dados|esses\s+dados|as\s+informacoes|a\s+tabela|o\s+relatorio|a\s+lista|a\s+tela|a\s+pagina|os\s+registros|os\s+resultados|os\s+numeros|as\s+linhas)\b/;

/** Verbo que pede leitura de um conjunto — "avalie", "analise", "resuma". */
const RX_PEDE_ANALISE = /\b(analis|avali|resum|compar|verifiq|confir|revis|explic|interpret|olh[ae]|veja|olhar)/;

/**
 * Sem acento e em minúscula.
 *
 * As duas regexes acima são escritas SEM acento e comparam contra o texto já
 * dobrado — porque a alternativa não funciona: `análise` (substantivo) não casa
 * com `analis`, e escrever `an[áa]lis` para cada palavra multiplica a chance de
 * esquecer uma. Foi assim que "faz uma análise" passou batido no primeiro teste.
 */
const dobrar = (s: string): string => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Pré-filtro BARATO: a mensagem "parece anafórica"? Só quem passa vai ao classificador. */
export function pareceAnaforico(question: string): boolean {
  const q = String(question ?? "").trim();
  if (q.length < 2) return false;
  return RX_ANAFORA.test(q);
}

/**
 * A mensagem aponta para um conjunto SEM dizer qual?
 *
 * Duas formas: a descrição definida ("avalie os dados") e o pedido de análise
 * sem objeto nenhum ("faz uma análise"). A segunda é a mais ambígua das duas —
 * não há sequer um substantivo para ancorar.
 */
export function referenciaVaga(question: string): boolean {
  const bruto = String(question ?? "").trim();
  if (bruto.length < 2) return false;
  const q = dobrar(bruto);
  if (RX_REFERENCIA_VAGA.test(q)) return true;
  // "faz uma análise", "avalia aí", "me dá uma olhada" — verbo de leitura sem objeto.
  return RX_PEDE_ANALISE.test(q) && q.split(/\s+/).length <= 6;
}

/**
 * Roda o classificador SÓ quando parece anáfora E há contexto para referir: relatório
 * na tela OU um turno anterior do assistente com conteúdo substancial (possível lista).
 *
 * `mudouTela` amplia o gatilho para as descrições definidas — ver
 * `RX_REFERENCIA_VAGA`. Só amplia: nada que já disparava deixa de disparar.
 */
export function deveClassificarSujeito(
  question: string,
  messages: ClarifyMsg[],
  temRelatorio: boolean,
  opts?: { mudouTela?: boolean },
): boolean {
  const aponta = pareceAnaforico(question) || (!!opts?.mudouTela && referenciaVaga(question));
  if (!aponta) return false;
  if (temRelatorio) return true;
  const ultAssist = [...(messages ?? [])].reverse().find((m) => m.role === "assistant");
  return !!ultAssist && String(ultAssist.content ?? "").length > 160;
}

export type SujeitoDecisao = { ambiguo: boolean; candidatos: string[]; refereRelatorio: boolean };
const NAO_AMBIGUO: SujeitoDecisao = { ambiguo: false, candidatos: [], refereRelatorio: false };

/** Classifica o referente da mensagem (modelo barato `query_rewrite`). Falha/dúvida →
 *  não-ambíguo (nunca trava o fluxo à toa). */
export async function classificarSujeito(args: {
  question: string;
  historico: ClarifyMsg[];
  colunasRelatorio: string[];
  temRelatorio: boolean;
  track: UsageMeta;
}): Promise<SujeitoDecisao> {
  // Imports DINÂMICOS: `@/lib/ai/config` valida env no topo do módulo — mantê-lo fora
  // do escopo do módulo deixa as funções PURAS (e seus testes) sem essa dependência.
  const { languageModel, hasAiKey, aiTimeout } = await import("@/lib/ai/config");
  const { generateObjectResiliente } = await import("@/lib/ai/generate");
  if (!(await hasAiKey("query_rewrite"))) return NAO_AMBIGUO;
  const hist = (args.historico ?? [])
    .slice(-4)
    .map((m) => `${m.role === "user" ? "Usuário" : "Assistente"}: ${String(m.content ?? "").slice(0, 900)}`)
    .join("\n");
  try {
    const { object } = await generateObjectResiliente({
      model: await languageModel("query_rewrite", { kind: "user", ...args.track }, args.track.p_base ?? ""),
      abortSignal: aiTimeout("query_rewrite"),
      schema: z.object({
        ambiguo: z.boolean(),
        candidatos: z.array(z.string()).max(12).nullable(),
        refere_relatorio: z.boolean(),
      }),
      prompt: `Você resolve o REFERENTE de uma mensagem de chat (RH, pt-BR). A MENSAGEM pode ter SUJEITO IMPLÍCITO (ex.: "qual o salário dele?", "e a matrícula?", "quanto ganham?", "detalha esses", "o primeiro"). Olhe o HISTÓRICO.
Decida:
- "ambiguo": true SOMENTE se a mensagem NÃO nomeia claramente a pessoa/entidade E há candidatos plausíveis no HISTÓRICO (pessoas/itens já listados) OU no relatório da tela. false se a mensagem já deixa claro quem/o quê, ou se não há candidato algum.
- "candidatos": rótulos CURTOS (nome ou matrícula) das pessoas/itens JÁ LISTADOS no histórico que a mensagem pode referir (máx. 12). Vazio se não houver lista.
- "refere_relatorio": true se a mensagem pode ser sobre os RESULTADOS do relatório da tela.
${args.colunasRelatorio.length ? `COLUNAS DO RELATÓRIO DA TELA: ${args.colunasRelatorio.join(", ")}` : "SEM relatório na tela."}
HISTÓRICO:
${hist || "(vazio)"}
MENSAGEM: ${args.question}`,
    });
    return {
      ambiguo: !!object.ambiguo,
      candidatos: (object.candidatos ?? []).map((s) => String(s).trim()).filter(Boolean).slice(0, 12),
      refereRelatorio: !!object.refere_relatorio && args.temRelatorio,
    };
  } catch {
    return NAO_AMBIGUO;
  }
}

/** Monta os botões do clarify (AGRUPADO): pessoas/itens listados · relatório · geral. */
export function montarOpcoesSujeito(dec: SujeitoDecisao, temRelatorio: boolean): Array<Record<string, unknown>> {
  const opcoes: Array<Record<string, unknown>> = [];
  if (dec.candidatos.length) {
    const amostra = dec.candidatos.slice(0, 3).join(", ");
    opcoes.push({
      id: "listados",
      label: dec.candidatos.length <= 3 ? `👥 ${amostra}` : `👥 Os ${dec.candidatos.length} listados`,
      ...(dec.candidatos.length > 3 ? { sublabel: `${amostra}…` } : {}),
      scope: { referente: "listados" },
    });
  }
  if (dec.refereRelatorio && temRelatorio) {
    opcoes.push({ id: "relatorio", label: "📄 Resultados do relatório da tela", scope: { referente: "relatorio", fonte: "relatorio", direto: true } });
  }
  opcoes.push({ id: "geral", label: "🌐 Consulta geral", scope: { referente: "geral" } });
  return opcoes;
}

/** Diretriz p/ o prompt depois que o usuário confirmou o referente. */
export function diretrizReferente(referente: string | undefined): string {
  if (referente === "listados")
    return "REFERENTE CONFIRMADO: a pergunta se refere aos itens/colaboradores LISTADOS nas mensagens anteriores desta conversa — use-os como sujeito, sem pedir de novo.";
  if (referente === "geral")
    return "REFERENTE CONFIRMADO: é uma consulta GERAL — NÃO restrinja aos itens específicos citados antes.";
  return "";
}
