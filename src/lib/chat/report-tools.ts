import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { normalizeSpec, sugerirTipo, CHART_TIPO_KEYS, type ChartSpec } from "./chart-spec";
import { normalizeReport, REPORT_FORMATS, type ReportFormat, type ReportSpec } from "@/lib/reports/report-spec";
import {
  colunaMaisProxima,
  expandirTabela,
  agruparDataset,
  listarDatasets,
  textoDatasetsDisponiveis,
  type DatasetRegistry,
  type Agregacao,
} from "./datasets";

/**
 * Ferramentas de VISUALIZAÇÃO do chat (widget/portal): a IA já obteve os dados
 * pelas ferramentas de integração e pode transformá-los em GRÁFICO interativo
 * (`montar_grafico`) ou num RELATÓRIO PDF (`gerar_relatorio`).
 *
 * Padrão sink (como `preencher_campo`): a tool só COLETA a intenção; o canal
 * (SSE `chart` / arquivo `file`) materializa depois do stream. Só entram quando
 * a chave já tem ferramentas de dados (senão não há o que visualizar).
 */

/** O pedido do usuário é por uma VISUALIZAÇÃO/exportação (relatório/PDF/gráfico…)?
 *  Usado para liberar as ferramentas visuais MESMO sem integração — um relatório
 *  pode sair do conteúdo da DOCUMENTAÇÃO, não só de dados de API. */
export const RX_VISUAL = /relat[óo]ri|\bpdf\b|gr[áa]fico|dashboard|exportar|\bexport\b|planilha|\bcsv\b|\bxlsx?\b|\bexcel\b|\bword\b|\bdocx?\b|\bppt\b|\bpptx\b|power\s*point|apresenta[çc][ãa]o|slides?|documento com os dados|gerar (um )?(arquivo|documento)/i;
export function pedeVisualizacao(pergunta: string): boolean {
  return RX_VISUAL.test(String(pergunta ?? ""));
}

/** Verbo de geração + tipo de arquivo ("gere um excel", "faz uma planilha"). Era uma
 *  segunda regex solta na rota, que DISCORDAVA de RX_VISUAL: o usuário pedia arquivo,
 *  o sistema entendia que pedia, e mesmo assim não entregava a ferramenta ao modelo. */
export const RX_GERA_ARQUIVO = new RegExp(
  // verbo de geração/entrega + (até 3 palavras) + tipo de arquivo
  "(ger[ae]r?|export[ae]r?|baix[ae]r?|download|cri[ae]r?|monta[er]?|fa[çc]a|faz(er)?|quero|me d[êe]|manda[er]?|envi[ae]r?|preciso)" +
    "\\s+(?:\\w+\\s+){0,3}(arquivo|documento|planilha|excel|xlsx|csv|pdf|word|docx|ppt|pptx|apresenta[çc]|slides?|relat[óo]rio|anexo)" +
    // …ou "baixar/download" apontando para o que está na conversa ("quero baixar isso")
    "|\\b(baix[ae]r|download)\\s+(isso|esses?|essas?|aqui|tudo|os dados|essa lista)",
  "i",
);
/** Verbos de plotagem que RX_VISUAL não cobria ("plota isso", "desenha um comparativo"). */
export const RX_PLOTAR = /\bplot(a|ar|e)\b|\bdesenh(a|ar|e)\b|comparativo em (pizza|barras|colunas|linha|[áa]rea)/i;

/**
 * O turno tem INTENÇÃO visual/de arquivo? União das três regexes + o aceite de oferta.
 *
 * Isto NÃO decide mais se as ferramentas existem (elas ficam sempre ligadas — um
 * follow-up como "agora em pizza" não casa com regex nenhuma e ficava sem ferramenta).
 * Serve para ENFATIZAR no prompt e para dimensionar o orçamento de passos.
 */
export function intencaoVisual(pergunta: string, messages: { role: string; content: string }[] = []): boolean {
  const q = String(pergunta ?? "");
  return RX_VISUAL.test(q) || RX_GERA_ARQUIVO.test(q) || RX_PLOTAR.test(q) || aceitouOfertaArquivo(q, messages);
}

/** Menção a ARQUIVO/geração na fala do assistente (para detectar oferta aceita). */
const RX_OFERTA_ARQUIVO = /excel|planilha|\bcsv\b|\bpdf\b|\bword\b|\bdocx?\b|\bppt\b|\bpptx\b|apresenta[çc]|documento|arquivo|relat[óo]ri|export|gerar?|montar|criar/i;
/** Aceite curto do usuário ("sim", "pode gerar", "isso", "manda", 👍…). */
const RX_ACEITE = /^\s*(sim|isso|claro|ok|okay|beleza|blz|positivo|afirmativo|perfeito|exato|com certeza|por favor|pode|quero|aceito|gera|gere|manda|mande|fa[çc]a|pode (gerar|fazer|mandar|criar|ser|sim)|👍)\b/i;
/**
 * O usuário está ACEITANDO uma oferta de arquivo (ex.: o assistente ofereceu um
 * Excel e ele respondeu "sim"/"pode")? Nesse caso as ferramentas visuais precisam
 * estar ligadas — senão a IA não consegue cumprir o que ofereceu e trava.
 */
export function aceitouOfertaArquivo(pergunta: string, messages: { role: string; content: string }[]): boolean {
  if (!RX_ACEITE.test(String(pergunta ?? ""))) return false;
  const ultimoAssistente = [...(messages ?? [])].reverse().find((m) => m.role === "assistant");
  return !!ultimoAssistente && RX_OFERTA_ARQUIVO.test(String(ultimoAssistente.content ?? ""));
}

const chartObject = z.object({
  // OPCIONAL de propósito: a AUSÊNCIA é o sinal de "o usuário não escolheu" — aí o
  // sistema oferece os tipos como botões (ou assume a sugestão calculada no servidor).
  // Era isto que exigia uma segunda ferramenta quase idêntica, que confundia o modelo.
  tipo: z
    .enum(CHART_TIPO_KEYS)
    .optional()
    .describe(
      "Tipo do gráfico — passe SÓ se o usuário disse qual quer. Se ele não disse, OMITA este campo: o sistema " +
        "mostra os tipos como botões no chat (ou escolhe o melhor pelos dados). Nunca pergunte o tipo em texto. " +
        "Básicos: colunas, barras, linha, area, pizza, rosca. EMPILHADOS (colunas_emp/barras_emp/area_emp) " +
        "somam as séries numa pilha. combo = 1ª série em colunas + as demais em linha. radar (teia) compara dimensões de " +
        "poucos itens. dispersao/bolha: série0 = valores de X, série1 = valores de Y (bolha: série2 = tamanho) e cada categoria " +
        "é o rótulo do ponto. heatmap = matriz categorias(linhas) × séries(colunas) colorida pelo valor. candle (OHLC) precisa " +
        "de 4 séries NA ORDEM: abertura, máxima, mínima, fechamento (financeiro). Em ARQUIVO, tipo que o formato não " +
        "desenha é trocado por um equivalente e o sistema avisa qual foi.",
    ),
  titulo: z.string().describe("Título curto e claro do gráfico."),
  // MUITOS DADOS: em vez de redigitar centenas de categorias/valores (limite de tokens), a IA
  // referencia o DATASET e o servidor monta o gráfico com 100% das linhas (agrupando).
  dados_de: z
    .string()
    .optional()
    .describe(
      "Id do DATASET para montar o gráfico com TODAS as linhas reais (a tabela da tela \"telaN\" ou o `_dataset` de uma ferramenta). Com isto, NÃO redigite `categorias`/`series`: informe `categoria` (coluna do rótulo/eixo X), `valor` (coluna do número) e `agregacao`. É a forma CERTA de graficar muitos registros — o servidor agrega no lugar do modelo.",
    ),
  categoria: z
    .string()
    .optional()
    .describe("Com `dados_de`: nome da COLUNA usada como rótulo/eixo X (ex.: \"Departamento\", \"Mês\"). O servidor agrupa por ela."),
  valor: z
    .string()
    .optional()
    .describe("Com `dados_de`: nome da COLUNA numérica agregada (ex.: \"Salário\"). Omita para CONTAR as linhas de cada categoria."),
  agregacao: z
    .enum(["soma", "media", "mediana", "min", "max", "contar", "distintos"])
    .optional()
    .describe("Com `dados_de`: como agregar o `valor` por categoria (padrão: soma; sem `valor`: contar)."),
  categorias: z
    .array(z.string())
    .optional()
    .describe("Rótulos do eixo X — ou as fatias (pizza/rosca). Redigite APENAS em gráficos pequenos; com `dados_de`, deixe vazio."),
  series: z
    .array(
      z.object({
        nome: z.string().describe("Nome da série (legenda)."),
        valores: z.array(z.number()).describe("Valores numéricos, NA MESMA ORDEM das categorias."),
      }),
    )
    .optional()
    .describe("Uma série (a maioria dos casos) ou várias para comparar. Redigite só em gráficos pequenos; com `dados_de`, deixe vazio. Pizza/rosca usam a 1ª série."),
  mediana: z
    .boolean()
    .optional()
    .describe(
      "Traça a linha da MEDIANA dos valores. Use quando ajudar a ler os dados (comparar valores, ver o que está acima/abaixo do meio). NÃO use em pizza/rosca.",
    ),
  tendencia: z
    .boolean()
    .optional()
    .describe(
      "Traça a linha de TENDÊNCIA/progressão (regressão). Use em séries ao longo do tempo ou progressões (colunas/linha/área). NÃO use em pizza/rosca nem em categorias sem ordem.",
    ),
});

const AGGS_CHART: readonly string[] = ["soma", "media", "mediana", "min", "max", "contar", "distintos"];

/**
 * Resultado de resolver o `dados_de` de um gráfico. Antes isto devolvia o input
 * INTOCADO em quatro falhas distintas (sem registro, id inexistente, coluna errada,
 * zero grupos) — o gráfico morria depois, no saneamento, com uma frase genérica que
 * não dizia o que corrigir. Agora cada falha tem nome e mensagem própria.
 */
type ResolucaoGrafico =
  | { ok: true; input: Record<string, unknown> }
  | { ok: false; causa: "dataset_inexistente" | "coluna_nao_encontrada" | "sem_grupos"; erro: string };

/** Monta categorias+series a partir de um DATASET (100% das linhas) quando o gráfico veio
 *  com `dados_de` — a IA não redigita os pontos. Agrupa por `categoria`, agrega `valor`
 *  (padrão soma; sem `valor`, conta). Até 2000 grupos. Sem `dados_de`/`categoria`, devolve
 *  o input como veio — é o caso legítimo do gráfico pequeno digitado pelo modelo. */
function resolverGraficoDataset(input: Record<string, unknown>, datasets?: DatasetRegistry): ResolucaoGrafico {
  const dd = String(input.dados_de ?? "").trim();
  const catCol = String(input.categoria ?? "").trim();
  if (!dd) return { ok: true, input };                        // gráfico digitado à mão
  if (!datasets) return { ok: true, input };                  // rota sem registro (nada a expandir)
  if (!datasets.list.some((d) => d.id === dd)) {
    return {
      ok: false,
      causa: "dataset_inexistente",
      erro: `dados_de:"${dd}" não existe neste turno. Disponíveis AGORA: ${textoDatasetsDisponiveis(datasets)}. ` +
        "Use um destes ids. Se o recorte foi num turno anterior, chame consultar_registros AGORA e use o `resultado_em` que ele devolver.",
    };
  }
  if (!catCol) {
    const cols = listarDatasets(datasets).find((d) => d.id === dd)?.colunas ?? [];
    return {
      ok: false,
      causa: "coluna_nao_encontrada",
      erro: `Você passou dados_de:"${dd}" mas não disse qual coluna é o eixo X. Informe \`categoria\` com uma destas: ${cols.slice(0, 12).join(", ")}.`,
    };
  }
  const valCol = String(input.valor ?? "").trim();
  const op: Agregacao = AGGS_CHART.includes(String(input.agregacao)) ? (input.agregacao as Agregacao) : valCol ? "soma" : "contar";
  const res = agruparDataset(datasets, dd, catCol, valCol || catCol, op, [], "E", 2000);
  const cols = listarDatasets(datasets).find((d) => d.id === dd)?.colunas ?? [];
  if (!res || "colunaNaoEncontrada" in res) {
    const faltou = res && "colunaNaoEncontrada" in res ? res.colunaNaoEncontrada : catCol;
    const perto = colunaMaisProxima(datasets, dd, faltou);
    return {
      ok: false,
      causa: "coluna_nao_encontrada",
      erro: `A coluna "${faltou}" não existe em "${dd}". Colunas reais: ${cols.slice(0, 12).join(", ")}.` +
        (perto ? ` Você quis dizer "${perto}"?` : "") + " Repita a chamada com uma dessas.",
    };
  }
  if (!res.grupos.length) {
    return {
      ok: false,
      causa: "sem_grupos",
      erro: `Agrupei "${dd}" por "${catCol}"${valCol ? ` somando "${valCol}"` : ""} e não sobrou nenhum valor ` +
        "(células vazias ou sem número). Tente `agregacao`:\"contar\" para contar linhas, ou escolha outra coluna: " +
        cols.slice(0, 12).join(", ") + ".",
    };
  }
  return {
    ok: true,
    input: {
      ...input,
      categorias: res.grupos.map((g) => g.grupo),
      series: [{ nome: valCol || "Quantidade", valores: res.grupos.map((g) => g.valor) }],
    },
  };
}

/** Sem `tipo`, escolhe pelos DADOS (é onde o modelo mais erra). Preserva o que veio. */
function comTipoSugerido(input: Record<string, unknown>): Record<string, unknown> {
  if (input.tipo) return input;
  const spec = normalizeSpec(input);
  return spec ? { ...input, tipo: sugerirTipo(spec) } : input;
}

/** Sem `dados_de` e sem pontos digitados: o modelo não mandou fonte nenhuma. */
const ERRO_SEM_FONTE =
  "Faltou a fonte dos pontos. Escolha UMA das duas formas:\n" +
  '(a) dados_de + categoria (+ valor + agregacao) — o servidor usa 100% das linhas. Ex.: {"tipo":"colunas","titulo":"Salário médio por cargo","dados_de":"tela1","categoria":"Cargo","valor":"Salário","agregacao":"media"}\n' +
  '(b) categorias + series, para gráficos pequenos. Ex.: {"tipo":"pizza","titulo":"Situação","categorias":["Ativo","Férias"],"series":[{"nome":"Colaboradores","valores":[128,14]}]}';

/**
 * Tool `montar_grafico` — uma só. Antes eram DUAS (`montar_grafico` e
 * `perguntar_tipo_grafico`) com schemas 95% idênticos e três descrições que se
 * contradiziam; o modelo escolhia errado. Agora a AUSÊNCIA de `tipo` é o sinal:
 * sem tipo → o chat mostra os tipos como botões, com a recomendação calculada AQUI
 * (é onde o modelo mais errava). O formato do SSE não muda — o widget é o mesmo.
 */
export function buildChartTool(sink: ChartSpec[], datasets?: DatasetRegistry, escolhas?: ChartChoice[]): ToolSet {
  return {
    montar_grafico: tool({
      description:
        "Monta um GRÁFICO interativo no chat a partir de dados numéricos que você JÁ obteve pelas ferramentas de " +
        "dados. Não invente números. Para MUITOS registros, NÃO redigite os pontos: passe `dados_de` (id do dataset) " +
        "+ `categoria` + `valor` + `agregacao` — o servidor monta o gráfico com TODAS as linhas. " +
        "SOBRE O TIPO: se o usuário disse qual quer, passe `tipo`. Se NÃO disse, OMITA `tipo` — o sistema mostra os " +
        "tipos como botões no chat e ele escolhe. Nunca pergunte o tipo em texto. " +
        "O usuário poderá trocar o tipo, navegar (scroll/zoom) e exportar (CSV/PNG) no próprio chat.",
      inputSchema: chartObject,
      execute: async (input) => {
        const bruto = input as Record<string, unknown>;
        const res = resolverGraficoDataset(bruto, datasets);
        if (!res.ok) return { erro: res.erro };
        const semTipo = !bruto.tipo;
        const spec = normalizeSpec(res.input);
        if (!spec) return { erro: ERRO_SEM_FONTE };
        // Sem tipo escolhido E ainda sem nenhum gráfico na conversa → oferece botões.
        // Depois do primeiro, assume a sugestão: perguntar toda vez vira ruído.
        if (semTipo && escolhas && !sink.length) {
          const rec = sugerirTipo(spec);
          escolhas.push({ spec: { ...spec, tipo: rec }, recomendado: rec, pergunta: "Que tipo de gráfico você prefere?" });
          return { ok: true, mensagem: `Ofereci os tipos de gráfico ("${spec.titulo || "sem título"}") como botões; o usuário vai escolher.` };
        }
        const final = semTipo ? { ...spec, tipo: sugerirTipo(spec) } : spec;
        sink.push(final);
        return {
          ok: true,
          mensagem: `Gráfico "${final.titulo || "sem título"}" pronto (${final.tipo}). Apresentei ao usuário; ele pode trocar o tipo e exportar.`,
        };
      },
    }),
  };
}

/** Escolha de tipo de gráfico oferecida como BOTÕES (o widget renderiza na hora). */
export type ChartChoice = { spec: ChartSpec; recomendado: string; pergunta: string };

/** Diretriz de uso das integrações: perguntar parâmetros em dúvida (refinar) e nunca
 *  fingir que não há dados sem confirmar. `toolForcado` = tool escolhida pelo roteador. */
export function integUsageDirective(toolForcado?: string): string {
  const regra =
    "ACESSO E SEGURANÇA (regra ABSOLUTA): você NÃO decide permissão nem segurança de dados. Quem valida o que o usuário " +
    "pode ver é o PRÓPRIO SISTEMA — a ferramenta já aplica a permissão/escopo do usuário (por perfil) DENTRO da consulta. " +
    "Portanto: se existe uma ferramenta para o dado pedido, CHAME-A. É TERMINANTEMENTE PROIBIDO dizer que 'não tem acesso', " +
    "que 'não pode consultar por segurança', 'por limitação das ferramentas', 'por motivos de segurança/privacidade', ou " +
    "que só pode ver os próprios dados; e é PROIBIDO mandar o usuário buscar/extrair/emitir o dado MANUALMENTE no sistema " +
    "(menus, aplicações, caminhos, abrir chamado). NÃO invente restrição alguma. As ÚNICAS limitações reais são: (a) não " +
    "existir uma ferramenta para aquilo, e (b) o sistema RECUSAR o acesso na PRÓPRIA chamada da ferramenta — só nesse caso, " +
    "informe exatamente o que a ferramenta retornou. Na dúvida sobre acesso, CHAME a ferramenta e deixe o sistema decidir.\n" +
    "USO DE FERRAMENTAS DE INTEGRAÇÃO (regra): ao buscar dados por uma integração, se um parâmetro OBRIGATÓRIO não estiver " +
    "claro no contexto (ex.: nome/matrícula da pessoa, período/mês, empresa, código), NÃO adivinhe nem chute — PERGUNTE ao " +
    "usuário o valor em UMA frase curta e só então chame a ferramenta (vá refinando até ter certeza). Se a ferramenta " +
    "retornar VAZIO ou erro, DIGA isso com clareza e pergunte se algum parâmetro deve ser ajustado; NUNCA responda como se " +
    "não houvesse dados sem antes confirmar os parâmetros com o usuário.\n" +
    "RÓTULO DAS COLUNAS: ao APRESENTAR os dados retornados pela ferramenta, cite cada campo pela LABEL amigável (ex.: " +
    "\"Cargo\", \"Data de admissão\", \"Salário\"), NUNCA pela CHAVE TÉCNICA do JSON/banco (ex.: \"COD_CARGO\", \"DS_NOME\", " +
    "\"VL_SALARIO\") — traduza o nome técnico para o termo que o usuário reconhece.\n" +
    "EFICIÊNCIA (menos passos): se a ferramenta já devolveu a lista COMPLETA (vem o marcador `_completo`, e NÃO " +
    "`_amostra`/`_nota`), você JÁ tem TODAS as linhas — se o pedido é só LISTAR/MOSTRAR/APRESENTAR, responda DIRETO com " +
    "esses dados, SEM chamar consultar_registros/agregar/estatísticas de novo. Use as ferramentas de dados apenas quando o " +
    "resultado veio como AMOSTRA (`_nota`) ou para FILTRAR/CONTAR/SOMAR/analisar um recorte específico.";
  return toolForcado
    ? `FONTE ESCOLHIDA: o usuário quer a informação via a ferramenta "${toolForcado}". Chame-a com os parâmetros do CONTEXTO da conversa (não use os dados da tela). ${regra}`
    : regra;
}

/**
 * Escopo de dados por PAINEL (p_portal): PO=Operador, PG=Gestor, PC=Colaborador. O
 * SISTEMA já aplica esse recorte dentro das ferramentas — isto é só para a IA
 * ENTENDER o alcance e responder certo (não inventa restrição; não vaza dados).
 */
/**
 * Anti-"punt" no MODO RELATÓRIO: o relatório da tela é uma VISÃO FILTRADA (uma empresa/
 * filial/período). Quando a pergunta é sobre um escopo que NÃO está nos dados carregados,
 * o modelo tende a mandar o usuário "mudar os filtros da tela e perguntar de novo" — o que
 * é justamente o empurrão que queremos evitar. Injetado só quando a base TEM ferramentas
 * (há de onde buscar). Curto de propósito (é multiplicado por passo).
 */
export function escopoRelatorioDirective(): string {
  return (
    "LIMITE DA TELA: o relatório que você analisa é uma VISÃO FILTRADA (empresa/filial/período específicos). Se a pergunta " +
    "for sobre um escopo QUE NÃO ESTÁ nos dados carregados (outra empresa, outra filial, outro período), é PROIBIDO mandar " +
    "o usuário 'mudar os filtros da tela e perguntar de novo'. Em vez disso: (1) diga em UMA linha que a tela cobre só o " +
    "escopo carregado; (2) OFEREÇA buscar pelo assistente — peça para ele responder \"Conhecimento da IA\" (ou repetir a " +
    "pergunta por essa fonte) que você consulta o sistema direto. Nunca devolva a tarefa para o usuário operar a tela."
  );
}

export function escopoAcessoDirective(portal?: string | null, perfil?: string | null): string {
  const p = String(portal ?? "").trim().toUpperCase();
  const perf = String(perfil ?? "").trim();
  const cab =
    "ESCOPO DE DADOS DO USUÁRIO (o SISTEMA já aplica isto dentro das ferramentas — é só para você entender o alcance e " +
    "responder certo; NÃO é uma restrição que VOCÊ impõe): ";
  // Como consultar OUTRA pessoa / VÁRIOS: preferir LISTA numa só chamada quando o
  // parâmetro aceita valores separados por vírgula; senão, iterar por valor único.
  const alvoLista =
    " CONSULTAR OUTROS / VÁRIOS: para os dados de OUTRA pessoa, passe a MATRÍCULA dela no parâmetro de matrícula (o sistema " +
    "libera conforme o painel). Para VÁRIOS colaboradores, PREFIRA a ferramenta que aceita LISTA: quando a descrição/exemplo " +
    "do parâmetro mostra valores separados por VÍRGULA (ex.: `123,344,502`), passe TODAS as matrículas (ou empresas/filiais/" +
    "centros de custo/cargos…) de uma vez em UMA ÚNICA chamada — NÃO chame uma vez por pessoa. Deixar esses filtros em BRANCO " +
    "traz TODOS do escopo liberado (ex.: todos os colaboradores de uma empresa/filial — ideal para CONTAR ou listar em massa). " +
    "Só faça uma-chamada-por-valor quando o parâmetro aceitar um ÚNICO valor. NÃO desista após uma só nem diga que só pode a " +
    "própria matrícula.";
  // Histórico/evolução de um fato do colaborador → LINHA DO TEMPO.
  const historico =
    " HISTÓRICO: pedidos de HISTÓRICO/EVOLUÇÃO (\"últimos N\", \"anteriores\", \"ao longo do tempo\", \"de um tempo atrás\", " +
    "\"quais já teve\") de um FATO do colaborador (cargo, salário, lotação…) → use a LINHA DO TEMPO com o `fato` " +
    "correspondente (ex.: o fato de CARGO para o histórico de cargos), com a matrícula do colaborador.";
  if (p === "PO") {
    return cab +
      "PAINEL DO OPERADOR — o usuário enxerga TUDO a que tem acesso no sistema. Não há recorte extra além do que o próprio " +
      "sistema já valida. Atenda normalmente, chamando as ferramentas." + alvoLista + historico;
  }
  if (p === "PG") {
    return cab +
      `PAINEL DO GESTOR (perfil ${perf || "GESTOR"}) — o usuário enxerga os dados dos COLABORADORES DA EQUIPE DELE e a ` +
      "ESTRUTURA (empresa/filial/centro de custo) do cadastro dele e dos colaboradores da equipe. Se ele pedir dados de " +
      "alguém FORA da equipe dele, o sistema RECUSA na chamada — aí informe que a pessoa está fora da equipe dele; não " +
      "invente outra restrição." + alvoLista + historico;
  }
  if (p === "PC") {
    return cab +
      `PAINEL DO COLABORADOR (perfil ${perf || "PORTAL"}) — o usuário SÓ pode ver os PRÓPRIOS dados; JAMAIS dados de outro ` +
      "colaborador. Se ele pedir dados de OUTRA pessoa, explique com clareza que no Painel do Colaborador só dá para " +
      "consultar os próprios dados. Nas ferramentas, deixe a `matricula` VAZIA (o sistema usa a dele), nunca a de terceiros." +
      historico;
  }
  return cab +
    "atenda com base no que o sistema liberar para este usuário; NÃO invente restrições — se algo não puder, é o sistema " +
    "que recusa na própria chamada da ferramenta." + historico;
}

const reportInput = z.object({
  titulo: z.string().describe("Título do relatório/arquivo."),
  subtitulo: z.string().optional().describe("Linha de contexto opcional (ex.: período, nome do usuário)."),
  formato: z
    .enum(["pdf", "xlsx", "csv", "docx", "pptx"])
    .optional()
    .describe(
      "Formato do arquivo a gerar, conforme o usuário pediu: 'pdf' (relatório de marca; é o padrão se omitido), 'xlsx' " +
        "(Excel) ou 'csv' (planilha — priorize TABELAS), 'docx' (Word — texto + tabelas) ou 'pptx' (PowerPoint — um " +
        "slide por bloco). Na dúvida sobre o formato, PERGUNTE. Para dados tabulares (listas), xlsx/csv são os melhores.",
    ),
  formatos: z
    .array(z.enum(["pdf", "xlsx", "csv", "docx", "pptx"]))
    .optional()
    .describe(
      "Use quando o usuário pedir o MESMO conteúdo em VÁRIOS formatos de uma vez (ex.: \"em Word, PPT e PDF\"): " +
        "liste todos aqui numa ÚNICA chamada — o sistema gera um arquivo por formato. Não faça uma chamada por formato.",
    ),
  blocos: z
    .array(
      z.object({
        tipo: z.enum(["texto", "tabela", "grafico"]).describe("O tipo deste bloco."),
        texto: z.string().optional().describe("Parágrafo — use quando tipo='texto' (introdução, observações)."),
        tabela: z
          .object({
            titulo: z.string().optional().describe("Título da tabela (opcional)."),
            colunas: z
              .array(z.string())
              .optional()
              .describe("Cabeçalhos das colunas — SÓ para tabelas PEQUENAS que você digitou. Com `dados_de` (tabela da tela ou de ferramenta), NÃO preencha: o servidor usa os cabeçalhos reais."),
            linhas: z
              .array(z.array(z.string()))
              .optional()
              .describe("Linhas digitadas (só para tabelas PEQUENAS montadas por você). Para dados da tela/ferramenta, use `dados_de` e NÃO redigite."),
            dados_de: z
              .string()
              .optional()
              .describe(
                "Id do DATASET a incluir por INTEIRO. Use o id de uma TABELA DA TELA (ex.: \"tela1\") ou o `_dataset` de uma ferramenta. Basta ESTE campo — NÃO precisa de `colunas` nem `campos`: o servidor inclui TODAS as linhas reais com os cabeçalhos certos. É a forma correta de exportar uma tabela da tela.",
              ),
            campos: z
              .array(z.string())
              .optional()
              .describe("Opcional e RARO: só para escolher/reordenar colunas de um dataset. Para exportar a tabela inteira, deixe vazio (passe apenas `dados_de`)."),
          })
          .optional()
          .describe("Tabela — use quando tipo='tabela'. PREFIRA tabelas para dados estruturados."),
        grafico: chartObject.optional().describe("Gráfico — use quando tipo='grafico' (visão visual opcional)."),
      }),
    )
    .min(1)
    .describe("Blocos do relatório, na ordem em que devem aparecer."),
});

/** Arquivo pronto para download (mesmo formato dos arquivos vindos das APIs). */
export type ArquivoGerado = { filename: string; mimeType: string; base64: string };
/** Gera o arquivo de verdade. INJETADO pela rota — mantém este módulo sem `server-only`. */
export type RenderRelatorio = (spec: ReportSpec) => Promise<ArquivoGerado>;

/** Teto por turno: cada arquivo trafega como data: URL no SSE. */
const MAX_ARQUIVOS_TURNO = 3;
const MAX_BYTES_ARQUIVO = 8 * 1024 * 1024;

/**
 * Tool `gerar_relatorio` — gera o arquivo AQUI, não depois do stream.
 *
 * Antes ela empurrava a spec para um sink e respondia "Entreguei ao usuário como
 * download" ANTES de qualquer geração; o render acontecia depois do stream e uma
 * falha virava só um `console.error`. O usuário ficava sem arquivo, com o modelo
 * jurando que tinha entregado. Gerando aqui, a falha volta como erro de ferramenta
 * no MESMO turno — e o modelo ainda pode reagir (trocar de formato, filtrar linhas).
 * O custo é a barreira da tool, onde o modelo já estava esperando de qualquer jeito.
 */
export function buildReportTool(
  sink: ReportSpec[],
  datasets?: DatasetRegistry,
  render?: RenderRelatorio,
  arquivos?: ArquivoGerado[],
): ToolSet {
  return {
    gerar_relatorio: tool({
      description:
        "Gera um ARQUIVO para download no formato pedido — `formato`: PDF (relatório de marca), Excel (xlsx), CSV, " +
        "Word (docx) ou PowerPoint (pptx) — a partir dos dados que você obteve pelas ferramentas OU do conteúdo da " +
        "DOCUMENTAÇÃO (ex.: um passo a passo/guia que você montou a partir dos artigos). Use SEMPRE que o usuário pedir o " +
        "resultado 'em PDF/Excel/CSV/Word/PowerPoint', uma planilha, um relatório, um documento ou uma apresentação. " +
        "Estruture em blocos, na ordem: 'texto' para introdução/observações, 'tabela' para os DADOS (prefira tabelas; em " +
        "xlsx/csv cada tabela vira uma planilha/bloco) e 'grafico' para uma visão visual opcional. Para incluir uma tabela " +
        "da TELA ou de ferramenta, NÃO redigite as linhas nem os cabeçalhos: passe SÓ `tabela.dados_de` com o id (ex.: " +
        "\"tela1\") — o servidor inclui todas as linhas reais. Não invente dados. NÃO escreva seu raciocínio nem os dados " +
        "no texto do chat — chame a ferramenta direto. O arquivo é entregue como download; não repita a tabela no texto.",
      inputSchema: reportInput,
      execute: async (input) => {
        let truncadoAviso = "";
        // Expande no servidor as tabelas que referenciam um DATASET (todas as
        // linhas reais), antes de sanear — assim o PDF não depende do modelo
        // redigitar centenas de linhas.
        const blocos: unknown[] = [];
        for (let i = 0; i < input.blocos.length; i++) {
          const b = input.blocos[i]!;
          const t = b.tabela;
          if (b.tipo === "tabela" && t?.dados_de && datasets) {
            const exp = expandirTabela(datasets, t.dados_de, t.campos, t.colunas);
            // ABORTA em vez de seguir. Sem isto, o id inválido caía nas `colunas`/
            // `linhas` vazias do modelo, o bloco era descartado no saneamento, e o
            // usuário recebia um arquivo VAZIO com "gerei com sucesso".
            if (!exp) {
              return {
                erro: `O bloco ${i + 1} (tabela) aponta para dados_de:"${t.dados_de}", que não existe neste turno. ` +
                  `Disponíveis AGORA: ${textoDatasetsDisponiveis(datasets)}. NENHUM arquivo foi gerado — ` +
                  "repita a chamada com um id válido, ou chame primeiro a ferramenta de dados.",
              };
            }
            if (exp.truncado) truncadoAviso = ` (limitei às primeiras ${exp.linhas.length} de ${exp.total} linhas)`;
            blocos.push({ ...b, tabela: { titulo: t.titulo, colunas: exp.colunas, linhas: exp.linhas } });
            continue;
          }
          // Gráfico com `dados_de`: monta categorias/valores do dataset (todas as linhas).
          if (b.tipo === "grafico" && b.grafico && (b.grafico as Record<string, unknown>).dados_de && datasets) {
            const res = resolverGraficoDataset(b.grafico as Record<string, unknown>, datasets);
            if (!res.ok) return { erro: `O bloco ${i + 1} (gráfico) falhou: ${res.erro} NENHUM arquivo foi gerado.` };
            blocos.push({ ...b, grafico: comTipoSugerido(res.input) });
            continue;
          }
          // Gráfico digitado à mão sem `tipo`: escolhe pelos dados, não cai em "colunas".
          if (b.tipo === "grafico" && b.grafico && !(b.grafico as Record<string, unknown>).tipo) {
            blocos.push({ ...b, grafico: comTipoSugerido(b.grafico as Record<string, unknown>) });
            continue;
          }
          blocos.push(b);
        }
        // Vários formatos numa chamada só ("Word + PPT + PDF") — sem gastar um passo
        // do orçamento por formato.
        const pedidos = (input.formatos?.length ? input.formatos : [input.formato ?? "pdf"])
          .filter((f): f is ReportFormat => (REPORT_FORMATS as string[]).includes(f));
        const formatos = [...new Set(pedidos.length ? pedidos : (["pdf"] as ReportFormat[]))];
        const specs: ReportSpec[] = [];
        for (const formato of formatos) {
          const spec = normalizeReport({ ...input, formato, blocos });
          if (!spec) {
            return {
              erro: "Não consegui montar o relatório: nenhum bloco válido sobrou. Cada bloco precisa de `texto`, " +
                "de `tabela` (com `dados_de` OU `colunas`+`linhas`) ou de `grafico`. NENHUM arquivo foi gerado.",
            };
          }
          specs.push(spec);
        }
        if (arquivos && arquivos.length + specs.length > MAX_ARQUIVOS_TURNO) {
          return { erro: `Limite de ${MAX_ARQUIVOS_TURNO} arquivos por resposta. Gere os demais numa próxima mensagem.` };
        }
        const rotulos: Record<ReportFormat, string> = { pdf: "PDF", xlsx: "Excel (xlsx)", csv: "CSV", docx: "Word (docx)", pptx: "PowerPoint (pptx)" };
        const gerados: string[] = [];
        for (const spec of specs) {
          sink.push(spec);
          if (!render || !arquivos) { gerados.push(rotulos[spec.formato]); continue; }
          try {
            const arq = await render(spec);
            if (arq.base64.length * 0.75 > MAX_BYTES_ARQUIVO) {
              return { erro: `O ${rotulos[spec.formato]} passou de 8 MB. Reduza as linhas (filtre antes) ou use csv/xlsx, que são mais leves.` };
            }
            arquivos.push(arq);
            gerados.push(`${rotulos[spec.formato]} — ${arq.filename}`);
          } catch (e) {
            return {
              erro: `Falhou ao gerar o ${rotulos[spec.formato]}: ${e instanceof Error ? e.message : String(e)}. ` +
                "DIGA isso ao usuário; não afirme que entregou. Tente outro formato ou menos linhas.",
            };
          }
        }
        const avisos = [...new Set(specs.flatMap((s) => s.avisos ?? []))];
        return {
          ok: true,
          mensagem:
            `Relatório "${specs[0]!.titulo}" gerado: ${gerados.join(" · ")} (${specs[0]!.blocos.length} bloco(s))${truncadoAviso}. ` +
            "O sistema anexa o(s) arquivo(s) ao final desta resposta — descreva como um link de download." +
            (avisos.length ? " AVISE o usuário: " + avisos.join(" ") : ""),
        };
      },
    }),
  };
}

/**
 * As três ferramentas visuais numa chamada só. Existe porque as duas rotas de chat
 * montavam a lista de argumentos separadamente e o portal esquecia o `datasets` —
 * `dados_de` nunca funcionou lá. Com um construtor único, não há o que esquecer.
 */
export type VisualSinks = {
  charts: ChartSpec[];
  /** Omita onde o cliente não renderiza o evento `chart_choice` (portal): sem ele, o
   *  gráfico sem `tipo` sai direto com o tipo sugerido, em vez de sumir. */
  chartChoices?: ChartChoice[];
  reports: ReportSpec[];
  arquivos?: ArquivoGerado[];
};
export function buildVisualTools(sinks: VisualSinks, datasets?: DatasetRegistry, render?: RenderRelatorio): ToolSet {
  return {
    ...buildChartTool(sinks.charts, datasets, sinks.chartChoices),
    ...buildReportTool(sinks.reports, datasets, render, sinks.arquivos),
  };
}
