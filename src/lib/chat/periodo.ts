/**
 * PERÍODO AUSENTE: perguntar ANTES de consultar, com as opções na mão.
 *
 * Medido em 20 dias de produção: das 200 chamadas a ferramentas com parâmetro de
 * data preenchido pelo modelo, **110 (55%) partiram de mensagens sem nenhum sinal
 * de período** — o modelo escolheu sozinho. Um caso real: "Quero ver os eventos de
 * apuração de ponto da matrícula 205818" virou 114 eventos de um intervalo que
 * ninguém pediu.
 *
 * ── Por que um portão, e não uma instrução no prompt ────────────────────────
 * A instrução foi tentada e medida (`DIRETIVA_PERGUNTAR`): cinco modelos de três
 * provedores continuaram perguntando de menos em 8 a 10 das 10 ocasiões, com e
 * sem a diretiva. O instinto de agir vence o texto. Já um portão no servidor
 * decide igual em todo modelo, e é testável linha a linha — que é o que a
 * precisão comercial exige.
 *
 * ── Onde ele NÃO pode disparar ──────────────────────────────────────────────
 * O período pode ter sido dito TURNOS ATRÁS ("me traga março/2025" → "e abril?").
 * Por isso a checagem lê a janela recente da conversa, não só a última mensagem:
 * perguntar de novo o que a pessoa já respondeu é o defeito que este módulo
 * existe para não criar.
 */

/**
 * NORMALIZA antes de casar — e isso não é higiene, é correção.
 *
 * `\b` em JavaScript é ASCII: em "últimos", a borda antes do `ú` NUNCA casa,
 * porque `ú` não é caractere de palavra. E `_` É caractere de palavra, então
 * `\bdata\b` não casa `data_inicial` — que é justamente como os parâmetros das
 * ferramentas se chamam. Os dois defeitos foram pegos pelos testes deste módulo.
 *
 * Tirando acento e trocando separador por espaço, tudo vira ASCII e o `\b`
 * volta a significar o que parece significar.
 */
function norm(txt: string): string {
  return String(txt ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\-.]+/g, " ")
    .toLowerCase();
}

/** Sinais de que a pessoa JÁ disse o período — data, mês, ou referência relativa. */
const RX_PERIODO =
  new RegExp(
    [
      // Datas escritas: 01/03, 01/03/2025, 2025-03, 03/2025
      String.raw`\d{1,2}\/\d{1,2}(\/\d{2,4})?`, String.raw`\d{4}-\d{2}`, String.raw`\b\d{2}\/\d{4}\b`, String.raw`\b(19|20)\d{2}\b`,
      // Meses por extenso
      String.raw`\bjaneiro|\bfevereiro|\bmarco\b|\babril|\bmaio|\bjunho|\bjulho|\bagosto|\bsetembro|\boutubro|\bnovembro|\bdezembro`,
      // Dias relativos
      String.raw`\bhoje\b|\bontem\b|\banteontem\b|\bamanha\b`,
      /**
       * DEMONSTRATIVO + UNIDADE — a forma que as pessoas realmente usam.
       *
       * A primeira versão só cobria "este mês" e "este ano", e o portão disparava
       * em "Quais são as minhas reuniões DESTE mês?", "marcaram o ponto NESSE mês",
       * "quero saber NESTE período" — 8 dos 12 disparos medidos eram isso. Perguntar
       * o período a quem acabou de dizer o período é o defeito que este portão
       * existe para não criar.
       */
      /**
       * DEMONSTRATIVO + (quantificador) + UNIDADE, no singular OU no plural.
       *
       * A versão anterior exigia demonstrativo colado à unidade e só no
       * singular. Numa conversa real de 20/08 isso custou caro: a pessoa
       * escreveu "nesses DOIS MESES" e "para os DOIS MESES", com fevereiro e
       * março já estabelecidos na conversa, e o portão bloqueou CATORZE chamadas
       * seguidas com "PERÍODO NÃO INFORMADO". O agente tentou fazer a coisa
       * certa e o guard impediu, até ele desistir e voltar a explicar a tela.
       */
      String.raw`\b(est[ea]s?|ess[ea]s?|nest[ea]s?|ness[ea]s?|dest[ea]s?|dess[ea]s?|[oa]s)\s+(\d+|dois|duas|tr[êe]s|quatro|cinco|seis|ultimos?|[úu]ltim[oa]s?)?\s*(mes|meses|ano|anos|semanas?|periodos?|dias?|trimestres?|semestres?|compet[êe]ncias?)\b`,
      // "dois meses", "3 meses", "seis semanas" — sem demonstrativo nenhum.
      String.raw`\b(\d+|dois|duas|tr[êe]s|quatro|cinco|seis)\s+(meses|semanas|dias|anos|trimestres|semestres|compet[êe]ncias)\b`,
      // "fevereiro e março", "de janeiro a junho" — dois meses citados por extenso.
      String.raw`\b(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b.{0,12}\b(e|a|至|ate|at[ée])\b.{0,4}\b(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b`,
      String.raw`\b(mes|ano|semana|periodo|trimestre|semestre) (atual|corrente|passad[oa]|anterior|que vem|vigente)\b`,
      String.raw`\bsemana passada\b|\bmes passado\b|\bano passado\b`,
      String.raw`\bultim[oa]s? \d*\s*(dia|semana|mes|ano|trimestre|semestre)`,
      String.raw`\bdesde \w|\bentre .* e |\bperiodo de|\ba partir de\b`,
    ].join("|"),
  );

/** A mensagem (ou a janela recente) traz período? */
export function temSinalDePeriodo(texto: string): boolean {
  return RX_PERIODO.test(norm(texto));
}

type ParamTool = { nome?: unknown; descricao?: unknown; origem?: unknown; obrigatorio?: unknown };

/**
 * O parâmetro é de PERÍODO, quem preenche é o MODELO, e a API o EXIGE?
 *
 * As três condições vieram de medir o portão contra 20 dias reais antes de ligá-lo:
 *
 * `origem` — data resolvida pelo servidor (a competência do holerite) não depende
 * do que a pessoa disse; perguntar seria atrito puro.
 *
 * `obrigatorio` — é o que separa o dano do ruído, e a primeira versão sem ele
 * errava quase tudo. `informacoes_pessoais_funcionais_resumido` tem quatro datas
 * OPCIONAIS (admissão, situação): "Traga meus colaboradores" não precisa de
 * período nenhum, e o portão perguntaria assim mesmo. Já `consultar_marcacoes` e
 * `frequencia_resultado_apuracao_detalhe` EXIGEM data — aí, calado, o modelo é
 * obrigado a inventar um intervalo, e foi isso que devolveu 114 eventos que
 * ninguém pediu.
 */
export function ehParamDePeriodo(p: ParamTool): boolean {
  if (p?.origem !== "modelo") return false;
  if (p?.obrigatorio !== true) return false;
  const txt = norm(`${String(p?.nome ?? "")} ${String(p?.descricao ?? "")}`);
  return /\b(data|datas|dt|periodo|inicio|inicial|fim|final|competencia|mes|ano)\b/.test(txt);
}

export type ToolComPeriodo = { key: string; name: string; params: unknown };

/** Quais das ferramentas do turno pedem período ao modelo. */
export function toolsQuePedemPeriodo(tools: readonly ToolComPeriodo[]): string[] {
  return tools
    .filter((t) => (Array.isArray(t.params) ? (t.params as ParamTool[]) : []).some(ehParamDePeriodo))
    .map((t) => t.key);
}

export type OpcaoPeriodo = { id: string; label: string; de: string; ate: string };

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * As opções oferecidas. O dono foi explícito: "perguntar o período mas já dando
 * sugestões" — uma pergunta em aberto devolve à pessoa o trabalho de formatar
 * data, que é justamente o que ela veio evitar.
 */
export function opcoesDePeriodo(hoje = new Date()): OpcaoPeriodo[] {
  const a = hoje.getUTCFullYear(), m = hoje.getUTCMonth();
  const ini = (ano: number, mes: number) => new Date(Date.UTC(ano, mes, 1));
  const fim = (ano: number, mes: number) => new Date(Date.UTC(ano, mes + 1, 0));
  const nome = (d: Date) =>
    ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"][d.getUTCMonth()]!;
  const mesAnterior = ini(a, m - 1);
  return [
    { id: "mes_atual", label: `Mês atual (${nome(ini(a, m))}/${a})`, de: iso(ini(a, m)), ate: iso(hoje) },
    { id: "mes_anterior", label: `Mês anterior (${nome(mesAnterior)}/${mesAnterior.getUTCFullYear()})`, de: iso(mesAnterior), ate: iso(fim(a, m - 1)) },
    { id: "ultimos_3", label: "Últimos 3 meses", de: iso(ini(a, m - 2)), ate: iso(hoje) },
    { id: "ano_atual", label: `Ano de ${a}`, de: iso(ini(a, 0)), ate: iso(hoje) },
  ];
}

/**
 * Decide se o turno precisa da pergunta de período.
 *
 * Só devolve `true` quando TODAS valem: alguma ferramenta do turno pede período ao
 * modelo, e nem a mensagem nem a janela recente da conversa trazem um. As demais
 * condições do turno (social, continuação do laço, período já escolhido) ficam com
 * quem chama — são estado da rota, não deste módulo.
 */
export function precisaPerguntarPeriodo(args: {
  pergunta: string;
  /** Janela recente da conversa — o período costuma vir de turnos atrás. */
  historico?: readonly { role?: string; content: string }[];
  tools: readonly ToolComPeriodo[];
}): { precisa: boolean; tools: string[] } {
  const tools = toolsQuePedemPeriodo(args.tools);
  if (!tools.length) return { precisa: false, tools: [] };
  if (temSinalDePeriodo(args.pergunta)) return { precisa: false, tools };
  /**
   * SÓ as mensagens da PESSOA.
   *
   * A primeira versão lia o histórico inteiro e o portão nunca disparava em 20
   * dias — porque as RESPOSTAS do agente são cheias de datas ("período aquisitivo
   * 03/06/2025 a 02/06/2026"), e qualquer resposta anterior fazia o turno seguinte
   * parecer que a pessoa tinha informado um período. Quem precisa ter dito o
   * período é ela; o agente citando datas é justamente o que se quer evitar.
   *
   * A janela é curta de propósito: um "março/2025" de vinte turnos atrás não
   * governa o pedido de agora.
   */
  const recentes = (args.historico ?? [])
    .filter((m) => (m.role ?? "user") === "user")
    .slice(-3)
    .map((m) => String(m.content ?? ""))
    .join(" ");
  if (temSinalDePeriodo(recentes)) return { precisa: false, tools };
  return { precisa: true, tools };
}

/**
 * A ferramenta EXIGE período e a pessoa não deu nenhum?
 *
 * Checagem feita na EXECUÇÃO, não antes do modelo escolher. Antes da escolha a
 * rota só vê as ~20 ferramentas ofertadas, e bastava uma delas exigir data para
 * a pergunta disparar: medido em 20 dias, 159 dos 1.176 turnos (14%) receberiam
 * a pergunta, incluindo "Faça um PDF dessa análise" e "Hi". Aqui a ferramenta já
 * é conhecida, e a pergunta só aparece onde ela de fato faria falta.
 */
export function faltaPeriodoNaChamada(params: unknown, periodoInformado: boolean): boolean {
  if (periodoInformado) return false;
  return (Array.isArray(params) ? (params as ParamTool[]) : []).some(ehParamDePeriodo);
}

/**
 * O que a ferramenta devolve ao modelo quando o período falta.
 *
 * Não é um erro: é uma instrução com as opções prontas. O dono foi explícito —
 * "perguntar o período mas já dando sugestões" —, e devolver só "informe o
 * período" faria o modelo repassar uma pergunta em aberto, que é o atrito que
 * este caminho existe para evitar.
 */
export function respostaFaltaPeriodo(hoje = new Date()): { _erro: string; _perguntar: string; opcoes: string[] } {
  const o = opcoesDePeriodo(hoje);
  return {
    _erro: "PERÍODO NÃO INFORMADO",
    _perguntar:
      "Esta consulta exige um período e o usuário não disse qual. NÃO escolha um intervalo por conta " +
      "própria e NÃO chame esta ferramenta de novo sem a resposta dele. Pergunte de qual período ele quer, " +
      "oferecendo as opções abaixo em uma linha cada, e diga que ele também pode informar as datas.",
    opcoes: o.map((x) => `${x.label} (${x.de} a ${x.ate})`),
  };
}
