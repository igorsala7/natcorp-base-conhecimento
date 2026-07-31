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
export const RX_VISUAL = /relat[óo]ri|\bpdf\b|gr[áa]fico|dashboard|exportar|\bexport\b|planilha|\bcsv\b|\bxlsx?\b|\bexcel\b|\bword\b|\bdocx?\b|\bppt\b|\bpptx\b|power\s*point|apresenta[çc][ãa]o|slides?|documento com os dados|gerar (um )?(arquivo|documento)/i;
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

/** Escolha de tipo de gráfico oferecida como BOTÕES (o widget renderiza na hora). */
export type ChartChoice = { spec: ChartSpec; recomendado: string; pergunta: string };

const chartAskInput = chartObject.omit({ tipo: true }).extend({
  recomendado: z
    .enum(CHART_TIPO_KEYS)
    .optional()
    .describe("O tipo que VOCÊ recomenda (será destacado no botão). Baseie-se nos dados."),
  pergunta: z.string().optional().describe("A pergunta curta a exibir (ex.: 'Qual tipo de gráfico você prefere?')."),
});

/** Tool `perguntar_tipo_grafico` — oferece os tipos como BOTÕES em vez de perguntar em texto. */
export function buildChartAskTool(sink: ChartChoice[]): ToolSet {
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
        const spec = normalizeSpec({ ...resto, tipo: recomendado || "colunas" });
        if (!spec) return { erro: "Não consegui preparar: preciso de categorias e ao menos uma série com valores numéricos." };
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
