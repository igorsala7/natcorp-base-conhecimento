import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { normalizeSpec, CHART_TIPO_KEYS, type ChartSpec } from "./chart-spec";
import { normalizeReport, type ReportSpec } from "@/lib/reports/report-spec";
import { expandirTabela, agruparDataset, type DatasetRegistry, type Agregacao } from "./datasets";

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
  tipo: z
    .enum(CHART_TIPO_KEYS)
    .describe(
      "Tipo do gráfico. Básicos: colunas, barras, linha, area, pizza, rosca. EMPILHADOS (colunas_emp/barras_emp/area_emp) " +
        "somam as séries numa pilha. combo = 1ª série em colunas + as demais em linha. radar (teia) compara dimensões de " +
        "poucos itens. dispersao/bolha: série0 = valores de X, série1 = valores de Y (bolha: série2 = tamanho) e cada categoria " +
        "é o rótulo do ponto. heatmap = matriz categorias(linhas) × séries(colunas) colorida pelo valor. candle (OHLC) precisa " +
        "de 4 séries NA ORDEM: abertura, máxima, mínima, fechamento (financeiro). Se o usuário NÃO disse o tipo, PERGUNTE.",
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

/** Monta categorias+series a partir de um DATASET (100% das linhas) quando o gráfico veio
 *  com `dados_de` — a IA não redigita os pontos. Agrupa por `categoria`, agrega `valor`
 *  (padrão soma; sem `valor`, conta). Até 2000 grupos. Sem `dados_de`/`categoria` ou falha,
 *  devolve o input como veio (a IA redigitou os pontos, caso pequeno). */
function resolverGraficoDataset(input: Record<string, unknown>, datasets?: DatasetRegistry): Record<string, unknown> {
  const dd = String(input.dados_de ?? "").trim();
  const catCol = String(input.categoria ?? "").trim();
  if (!datasets || !dd || !catCol) return input;
  const valCol = String(input.valor ?? "").trim();
  const op: Agregacao = AGGS_CHART.includes(String(input.agregacao)) ? (input.agregacao as Agregacao) : valCol ? "soma" : "contar";
  const res = agruparDataset(datasets, dd, catCol, valCol || catCol, op, [], "E", 2000);
  if (!res || "colunaNaoEncontrada" in res || !res.grupos.length) return input;
  return {
    ...input,
    categorias: res.grupos.map((g) => g.grupo),
    series: [{ nome: valCol || "Quantidade", valores: res.grupos.map((g) => g.valor) }],
  };
}

/** Tool `montar_grafico` — coleta a spec e emite o gráfico interativo no chat. */
export function buildChartTool(sink: ChartSpec[], datasets?: DatasetRegistry): ToolSet {
  return {
    montar_grafico: tool({
      description:
        "Monta um GRÁFICO interativo no chat a partir de dados numéricos que você JÁ obteve pelas ferramentas de " +
        "dados. Use quando o usuário pedir um gráfico/visualização dos resultados. Não invente números — use os " +
        "valores reais. Para MUITOS registros (uma lista/tabela), NÃO redigite os pontos: passe `dados_de` (id do " +
        "dataset) + `categoria` + `valor` + `agregacao` — o servidor monta o gráfico com TODAS as linhas. Se o " +
        "usuário não escolheu o TIPO, pergunte a preferência antes de chamar. O usuário poderá TROCAR o tipo, " +
        "NAVEGAR (scroll/zoom) e EXPORTAR (CSV/PNG) no próprio chat.",
      inputSchema: chartObject,
      execute: async (input) => {
        const spec = normalizeSpec(resolverGraficoDataset(input as Record<string, unknown>, datasets));
        if (!spec) return { erro: "Não consegui montar: preciso de categorias e ao menos uma série com valores numéricos (ou `dados_de` + `categoria`)." };
        sink.push(spec);
        return {
          ok: true,
          mensagem: `Gráfico "${spec.titulo || "sem título"}" pronto (${spec.tipo}). Apresentei ao usuário; ele pode trocar o tipo e exportar.`,
        };
      },
    }),
  };
}

/** Escolha de tipo de gráfico oferecida como BOTÕES (o widget renderiza na hora). */
export type ChartChoice = { spec: ChartSpec; recomendado: string; pergunta: string };

const chartAskInput = chartObject.omit({ tipo: true }).extend({
  recomendado: z
    .enum(CHART_TIPO_KEYS)
    .optional()
    .describe("O tipo que VOCÊ recomenda (será destacado no botão). Baseie-se nos dados."),
  pergunta: z.string().optional().describe("A pergunta curta a exibir (ex.: 'Qual tipo de gráfico você prefere?')."),
});

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

/** Tool `perguntar_tipo_grafico` — oferece os tipos como BOTÕES em vez de perguntar em texto. */
export function buildChartAskTool(sink: ChartChoice[], datasets?: DatasetRegistry): ToolSet {
  return {
    perguntar_tipo_grafico: tool({
      description:
        "Use quando o usuário pedir um GRÁFICO mas NÃO tiver dito o TIPO. Em vez de perguntar em texto, passe os DADOS " +
        "reais (categorias + séries) e o tipo `recomendado`: o sistema mostra os tipos (colunas, barras, linha, área, " +
        "pizza, rosca) como BOTÕES no chat e o usuário escolhe — o gráfico aparece na hora. NÃO pergunte o tipo em texto " +
        "nem chame montar_grafico junto. Se o usuário JÁ disse o tipo, use montar_grafico direto.",
      inputSchema: chartAskInput,
      execute: async (input) => {
        const { recomendado, pergunta, ...resto } = input;
        const spec = normalizeSpec(resolverGraficoDataset({ ...resto, tipo: recomendado || "colunas" } as Record<string, unknown>, datasets));
        if (!spec) return { erro: "Não consegui preparar: preciso de categorias e ao menos uma série com valores numéricos (ou `dados_de` + `categoria`)." };
        sink.push({ spec, recomendado: recomendado || spec.tipo, pergunta: pergunta || "Que tipo de gráfico você prefere?" });
        return { ok: true, mensagem: `Ofereci os tipos de gráfico ("${spec.titulo || "sem título"}") como botões; o usuário vai escolher.` };
      },
    }),
  };
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

/** Tool `gerar_relatorio` — coleta a spec; o servidor gera o PDF (entregue como arquivo). */
export function buildReportTool(sink: ReportSpec[], datasets?: DatasetRegistry): ToolSet {
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
        const blocos = input.blocos.map((b) => {
          const t = b.tabela;
          if (b.tipo === "tabela" && t?.dados_de && datasets) {
            const exp = expandirTabela(datasets, t.dados_de, t.campos, t.colunas);
            if (exp) {
              if (exp.truncado) truncadoAviso = ` (limitei às primeiras ${exp.linhas.length} de ${exp.total} linhas)`;
              return { ...b, tabela: { titulo: t.titulo, colunas: exp.colunas, linhas: exp.linhas } };
            }
          }
          // Gráfico com `dados_de`: monta categorias/valores do dataset (todas as linhas).
          if (b.tipo === "grafico" && b.grafico && (b.grafico as Record<string, unknown>).dados_de && datasets) {
            return { ...b, grafico: resolverGraficoDataset(b.grafico as Record<string, unknown>, datasets) as typeof b.grafico };
          }
          return b;
        });
        const spec = normalizeReport({ ...input, blocos });
        if (!spec) return { erro: "Não consegui montar o relatório: preciso de ao menos um bloco válido (tabela, texto ou gráfico)." };
        sink.push(spec);
        const rotulo = { pdf: "PDF", xlsx: "Excel (xlsx)", csv: "CSV", docx: "Word (docx)", pptx: "PowerPoint (pptx)" }[spec.formato];
        return {
          ok: true,
          mensagem: `Arquivo "${spec.titulo}" gerado em ${rotulo} (${spec.blocos.length} bloco(s))${truncadoAviso}. Entreguei ao usuário como download.`,
        };
      },
    }),
  };
}

/** Diretriz de USO (alta prioridade) para gráficos/relatórios. */
export function visualsDirective(): string {
  return (
    "GRÁFICOS E RELATÓRIOS: quando o usuário pedir para VISUALIZAR os dados (um gráfico) ou um RELATÓRIO, primeiro " +
    "obtenha os números pelas ferramentas de dados e então:\n" +
    "- GRÁFICO: use SEMPRE o motor do assistente (`montar_grafico` / `perguntar_tipo_grafico`) — NUNCA o menu \"Ações\" → " +
    "\"Formato\" → \"Gráfico\" do Interactive Report/Grid da tela. Analise os dados e RECOMENDE o tipo mais adequado — série " +
    "ao longo do tempo/progressão → linha (ou área); comparação entre poucas categorias → colunas; muitas categorias ou " +
    "rótulos longos → barras (horizontais); partes de um todo em % → pizza (ou rosca). Se o usuário JÁ disse o tipo, chame " +
    "`montar_grafico` com os valores reais. Se o usuário NÃO disse o tipo, chame `perguntar_tipo_grafico` com os dados + o " +
    "tipo `recomendado`: o sistema mostra os tipos como BOTÕES e o usuário escolhe (o gráfico aparece na hora) — NÃO " +
    "pergunte o tipo em texto. NÃO descreva o gráfico em texto — a ferramenta o desenha.\n" +
    "- GRÁFICO — QUAL dataset (regra CRÍTICA): o `dados_de` do gráfico tem de apontar para o dataset EXATO que o usuário " +
    "quer ver. Se ele quer um RECORTE que você filtrou (ex.: 'faça o gráfico DESSES', 'dos 10 que você achou', 'só os " +
    "pagos'), use o id do SUBCONJUNTO — o `resultado_em` do `consultar_registros` — obtido NESTE MESMO turno. Se o filtro " +
    "foi num turno ANTERIOR, REFAÇA o `consultar_registros` agora para reobter o id do recorte e use ESSE id. É PROIBIDO " +
    "apontar `dados_de` para a tabela da tela inteira (\"telaN\") quando o usuário quer só o recorte — senão o gráfico traz " +
    "100% dos registros (ERRADO). Na dúvida sobre quais registros, confirme com o usuário antes de gráficar.\n" +
    "- GRÁFICO COM MUITOS DADOS: se o recorte/lista tem MUITOS registros (dezenas, centenas), NÃO redigite os pontos — passe " +
    "`dados_de` (o id CERTO, conforme a regra acima) + `categoria` (coluna do eixo X) + `valor` (coluna do número) + " +
    "`agregacao`. Mas se são POUCOS registros (ex.: 10) que você JÁ tem no contexto, redigite categorias/series direto — é " +
    "mais simples e não corre risco de pegar o dataset errado.\n" +
    "- MEDIANA e TENDÊNCIA: pela sua leitura do CONTEXTO, ative `mediana` quando ajudar a comparar os valores e " +
    "`tendencia` quando houver progressão/série temporal (ambas só em colunas/linha/área/barras — nunca em " +
    "pizza/rosca). Não ative nas duas por padrão: só quando agregam.\n" +
    "- ARQUIVO (PDF/Excel/CSV/Word/PowerPoint): quando o usuário pedir o resultado 'em PDF', um relatório, uma planilha " +
    "(Excel/CSV), um documento (Word) ou uma apresentação (PowerPoint), CHAME `gerar_relatorio` com o `formato` " +
    "correspondente (pdf/xlsx/csv/docx/pptx) + título + blocos ('texto' para as explicações/passos, 'tabela' para dados, " +
    "'gráfico' opcional). Escolha o formato pelo pedido; se ele não disse e o conteúdo é uma LISTA de dados, sugira/use " +
    "xlsx (ou csv); se for texto/passo a passo, pdf ou docx; se for apresentação, pptx — na dúvida, PERGUNTE. O conteúdo " +
    "pode vir das ferramentas OU da DOCUMENTAÇÃO (ex.: monte o passo a passo com o que os artigos trazem). NÃO se recuse a " +
    "gerar só porque a documentação é parcial: compile o que existe (e diga no texto o que ficou de fora). O arquivo vai " +
    "como download — não repita a tabela inteira no chat.\n" +
    "- PÁGINA SEM TABELA/RELATÓRIO (dados só na tela): se pedirem um documento e NÃO houver uma tabela/dataset da tela " +
    "(nenhum id [dados_de=\"...\"] no contexto), monte o arquivo AUTOMATICAMENTE com o CONTEÚDO DA TELA que você recebeu " +
    "(o bloco de conteúdo da página, os campos e seus valores). Use blocos `texto` e, quando houver itens/valores, um bloco " +
    "`tabela` com `colunas` e `linhas` que VOCÊ digita a partir do que está NA TELA — aqui NÃO use `dados_de` (não existe " +
    "dataset). Não se recuse por 'não ter ferramenta nem tabela': os dados da tela BASTAM e são a fonte padrão quando a " +
    "página não tem relatório.\n" +
    "- PRECISA CHAMAR A FERRAMENTA (senão não há arquivo): para ENTREGAR um arquivo você TEM de chamar `gerar_relatorio` " +
    "NESTA mesma resposta. NUNCA diga que 'gerou', 'anexou' ou que 'o download vai iniciar automaticamente' sem ter chamado " +
    "a ferramenta. O arquivo aparece como um LINK DE DOWNLOAD no chat (NÃO é um download automático do navegador) — descreva " +
    "assim. Se `gerar_relatorio` retornar erro, DIGA ao usuário que não conseguiu e por quê — não finja sucesso.\n" +
    "- VOCÊ SEMPRE CONSEGUE GERAR (regra ABSOLUTA): gerar Excel/CSV/PDF/Word/PowerPoint É a sua ferramenta `gerar_relatorio`. " +
    "É TERMINANTEMENTE PROIBIDO dizer que gerar o arquivo está 'fora da sua capacidade', que 'não pode fazer isso' ou pedir " +
    "para o usuário BAIXAR/EXPORTAR o relatório pelo próprio sistema/menu — isso NUNCA pode acontecer. Se você OFERECEU um " +
    "arquivo e o usuário ACEITOU (mesmo com um 'sim'/'pode' curto), CHAME `gerar_relatorio` AGORA, na mesma resposta — não " +
    "reescreva os dados no chat no lugar do arquivo. Nunca ofereça um arquivo que você não vá gerar com a ferramenta.\n" +
    "- GRÁFICO DENTRO DO ARQUIVO: se o usuário pedir o Excel/Word/PDF/PowerPoint COM um GRÁFICO dos dados (ex.: \"faz um " +
    "ppt com gráfico\", \"um excel com um gráfico das faltas\"), INCLUA um bloco `grafico` na chamada (tipo + categorias " +
    "+ series com os valores reais) — o arquivo é renderizado com o GRÁFICO desenhado (no Excel/Word como imagem, no PPT " +
    "nativo, no PDF vetorial). Não deixe de fora: se pediram gráfico, o bloco `grafico` é OBRIGATÓRIO no relatório.\n" +
    "- FORMATAÇÃO DO TEXTO: nos blocos `texto` você PODE usar markdown — títulos com `##`, **negrito**, *itálico*, listas " +
    "com `-` ou `1.` — o gerador converte em títulos destacados, negrito e listas de verdade (nada de marcação crua no " +
    "arquivo). Estruture bem: um título de seção antes de cada parte, destaques em negrito no que importa.\n" +
    "- TODOS OS DADOS no relatório: quando a ferramenta retornar uma LISTA, ela vem com um id em `_dataset` (e `_total`, " +
    "`_colunas`). Para a tabela do relatório, NÃO redigite as linhas — passe `tabela.dados_de` com esse id, `colunas` " +
    "(cabeçalhos) e `campos` (as chaves de `_colunas`, na mesma ordem). O servidor inclui TODAS as linhas reais. Redigite " +
    "linhas só em tabelas pequenas que você mesmo montou. Ignore os campos `_dataset`/`_total`/`_colunas` na sua resposta " +
    "em texto (são metadados internos). IMPORTANTE: o `_dataset` só vale NESTE turno — para gerar o relatório com todos os " +
    "dados, CHAME a ferramenta de dados AGORA (mesmo que já tenha consultado antes) e use o `_dataset` que ela retornar.\n" +
    "Nunca invente dados para preencher um gráfico ou relatório: use apenas o que as ferramentas retornaram."
  );
}
