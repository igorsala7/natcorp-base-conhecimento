import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { normalizeSpec, CHART_TIPO_KEYS, type ChartSpec } from "./chart-spec";
import { normalizeReport, type ReportSpec } from "@/lib/reports/report-spec";
import { expandirTabela, type DatasetRegistry } from "./datasets";

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
export const RX_VISUAL = /relat[óo]ri|\bpdf\b|gr[áa]fico|dashboard|exportar|\bexport\b|planilha|\bcsv\b|\bxlsx?\b|\bexcel\b|documento com os dados/i;
export function pedeVisualizacao(pergunta: string): boolean {
  return RX_VISUAL.test(String(pergunta ?? ""));
}

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
            linhas: z
              .array(z.array(z.string()))
              .optional()
              .describe("Linhas digitadas (só para tabelas PEQUENAS montadas por você). Para dados de uma ferramenta, use `dados_de`."),
            dados_de: z
              .string()
              .optional()
              .describe(
                "Id do DATASET (o campo `_dataset` que a ferramenta retornou). Quando presente, o servidor inclui TODAS as linhas reais — não redigite os dados. Use SEMPRE que o usuário pedir 'todos os dados'.",
              ),
            campos: z
              .array(z.string())
              .optional()
              .describe("Chave de cada coluna na linha do dataset (nomes de `_colunas`), na MESMA ordem de `colunas`. Só com `dados_de`."),
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
        "Gera um RELATÓRIO em PDF (layout de marca) a partir dos dados que você obteve pelas ferramentas OU do conteúdo " +
        "da DOCUMENTAÇÃO (ex.: um passo a passo/guia que você montou a partir dos artigos). Use SEMPRE que o usuário " +
        "pedir o resultado 'em PDF', um relatório ou um documento. Estruture em blocos, na ordem: 'texto' para " +
        "introdução/observações, 'tabela' para os DADOS (prefira tabelas) e 'grafico' para uma visão visual " +
        "opcional. Para incluir TODOS os dados de uma consulta, NÃO redigite as linhas: passe `tabela.dados_de` com " +
        "o id `_dataset` que a ferramenta retornou (+ `colunas` e `campos`) — o servidor inclui todas as linhas reais. " +
        "Não invente dados. O PDF é entregue como download no chat — não repita a tabela inteira no texto.",
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
          return b;
        });
        const spec = normalizeReport({ ...input, blocos });
        if (!spec) return { erro: "Não consegui montar o relatório: preciso de ao menos um bloco válido (tabela, texto ou gráfico)." };
        sink.push(spec);
        return {
          ok: true,
          mensagem: `Relatório "${spec.titulo}" gerado (${spec.blocos.length} bloco(s))${truncadoAviso}. Entreguei o PDF ao usuário como download.`,
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
    "- RELATÓRIO/PDF: quando o usuário pedir o resultado 'em PDF', um relatório ou um documento, CHAME `gerar_relatorio` " +
    "(título + blocos: 'texto' para as explicações/passos, 'tabela' para dados, 'gráfico' opcional). O conteúdo pode vir " +
    "das ferramentas OU da DOCUMENTAÇÃO (ex.: monte o passo a passo com o que os artigos trazem). NÃO se recuse a gerar o " +
    "PDF só porque a documentação é parcial: compile o que existe (e diga no texto o que ficou de fora). O PDF vai como " +
    "download — não repita a tabela inteira no chat.\n" +
    "- TODOS OS DADOS no relatório: quando a ferramenta retornar uma LISTA, ela vem com um id em `_dataset` (e `_total`, " +
    "`_colunas`). Para a tabela do relatório, NÃO redigite as linhas — passe `tabela.dados_de` com esse id, `colunas` " +
    "(cabeçalhos) e `campos` (as chaves de `_colunas`, na mesma ordem). O servidor inclui TODAS as linhas reais. Redigite " +
    "linhas só em tabelas pequenas que você mesmo montou. Ignore os campos `_dataset`/`_total`/`_colunas` na sua resposta " +
    "em texto (são metadados internos). IMPORTANTE: o `_dataset` só vale NESTE turno — para gerar o relatório com todos os " +
    "dados, CHAME a ferramenta de dados AGORA (mesmo que já tenha consultado antes) e use o `_dataset` que ela retornar.\n" +
    "Nunca invente dados para preencher um gráfico ou relatório: use apenas o que as ferramentas retornaram."
  );
}
