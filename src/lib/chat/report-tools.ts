import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { normalizeSpec, CHART_TIPO_KEYS, type ChartSpec } from "./chart-spec";
import { normalizeReport, type ReportSpec } from "@/lib/reports/report-spec";

/**
 * Ferramentas de VISUALIZAÇÃO do chat (widget/portal): a IA já obteve os dados
 * pelas ferramentas de integração e pode transformá-los em GRÁFICO interativo
 * (`montar_grafico`) ou num RELATÓRIO PDF (`gerar_relatorio`).
 *
 * Padrão sink (como `preencher_campo`): a tool só COLETA a intenção; o canal
 * (SSE `chart` / arquivo `file`) materializa depois do stream. Só entram quando
 * a chave já tem ferramentas de dados (senão não há o que visualizar).
 */

const chartObject = z.object({
  tipo: z
    .enum(CHART_TIPO_KEYS)
    .describe("Tipo do gráfico. Se o usuário NÃO disse o tipo, PERGUNTE a preferência antes de chamar."),
  titulo: z.string().describe("Título curto e claro do gráfico."),
  categorias: z
    .array(z.string())
    .min(1)
    .describe("Rótulos do eixo X — ou as fatias, no caso de pizza/rosca (ex.: meses, setores)."),
  series: z
    .array(
      z.object({
        nome: z.string().describe("Nome da série (legenda)."),
        valores: z.array(z.number()).describe("Valores numéricos, NA MESMA ORDEM das categorias."),
      }),
    )
    .min(1)
    .describe("Uma série (a maioria dos casos) ou várias para comparar. Pizza/rosca usam a 1ª série."),
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

/** Tool `montar_grafico` — coleta a spec e emite o gráfico interativo no chat. */
export function buildChartTool(sink: ChartSpec[]): ToolSet {
  return {
    montar_grafico: tool({
      description:
        "Monta um GRÁFICO interativo no chat a partir de dados numéricos que você JÁ obteve pelas ferramentas de " +
        "dados. Use quando o usuário pedir um gráfico/visualização dos resultados. Não invente números — use os " +
        "valores reais. Se o usuário não escolheu o TIPO, pergunte a preferência (colunas, barras, linha, área, " +
        "pizza ou rosca) antes de chamar. O usuário poderá TROCAR o tipo e EXPORTAR (CSV/PNG) no próprio chat.",
      inputSchema: chartObject,
      execute: async (input) => {
        const spec = normalizeSpec(input);
        if (!spec) return { erro: "Não consegui montar: preciso de categorias e ao menos uma série com valores numéricos." };
        sink.push(spec);
        return {
          ok: true,
          mensagem: `Gráfico "${spec.titulo || "sem título"}" pronto (${spec.tipo}). Apresentei ao usuário; ele pode trocar o tipo e exportar.`,
        };
      },
    }),
  };
}

const reportInput = z.object({
  titulo: z.string().describe("Título do relatório."),
  subtitulo: z.string().optional().describe("Linha de contexto opcional (ex.: período, nome do usuário)."),
  blocos: z
    .array(
      z.object({
        tipo: z.enum(["texto", "tabela", "grafico"]).describe("O tipo deste bloco."),
        texto: z.string().optional().describe("Parágrafo — use quando tipo='texto' (introdução, observações)."),
        tabela: z
          .object({
            titulo: z.string().optional().describe("Título da tabela (opcional)."),
            colunas: z.array(z.string()).describe("Cabeçalhos das colunas."),
            linhas: z.array(z.array(z.string())).describe("Linhas; cada uma com as células na ordem das colunas."),
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
export function buildReportTool(sink: ReportSpec[]): ToolSet {
  return {
    gerar_relatorio: tool({
      description:
        "Gera um RELATÓRIO em PDF (layout de marca) a partir dos dados que você JÁ obteve pelas ferramentas. Use " +
        "quando o usuário pedir um relatório/documento dos dados. Estruture em blocos, na ordem: 'texto' para " +
        "introdução/observações, 'tabela' para os DADOS (prefira tabelas) e 'grafico' para uma visão visual " +
        "opcional. Não invente dados. O PDF é entregue como download no chat — não repita a tabela inteira no texto.",
      inputSchema: reportInput,
      execute: async (input) => {
        const spec = normalizeReport(input);
        if (!spec) return { erro: "Não consegui montar o relatório: preciso de ao menos um bloco válido (tabela, texto ou gráfico)." };
        sink.push(spec);
        return {
          ok: true,
          mensagem: `Relatório "${spec.titulo}" gerado (${spec.blocos.length} bloco(s)). Entreguei o PDF ao usuário como download.`,
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
    "- GRÁFICO: analise os dados e RECOMENDE o tipo mais adequado, explicando em uma frase — série ao longo do " +
    "tempo/progressão → linha (ou área); comparação entre poucas categorias → colunas; muitas categorias ou " +
    "rótulos longos → barras (horizontais); partes de um todo em % → pizza (ou rosca). Se o usuário não escolheu, " +
    "PERGUNTE confirmando sua recomendação. Depois chame `montar_grafico` com os valores reais. NÃO descreva o " +
    "gráfico em texto — a ferramenta o desenha.\n" +
    "- MEDIANA e TENDÊNCIA: pela sua leitura do CONTEXTO, ative `mediana` quando ajudar a comparar os valores e " +
    "`tendencia` quando houver progressão/série temporal (ambas só em colunas/linha/área/barras — nunca em " +
    "pizza/rosca). Não ative nas duas por padrão: só quando agregam.\n" +
    "- RELATÓRIO: chame `gerar_relatorio` com título + blocos (tabelas para os dados, texto para observações, " +
    "gráfico opcional). O PDF vai como download — não repita a tabela inteira no chat.\n" +
    "Nunca invente dados para preencher um gráfico ou relatório: use apenas o que as ferramentas retornaram."
  );
}
