import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { consultarDataset, OPERADORES, type DatasetRegistry, type Filtro, type Operador } from "./datasets";

/**
 * Ferramenta `consultar_registros` — FILTRA/consulta um dataset já coletado
 * (todas as páginas) NO SERVIDOR, sobre 100% das linhas. Existe para corrigir um
 * bug grave: quando o relatório é grande, o modelo só vê um resumo (amostra) e,
 * ao filtrar "só os registros que têm X", contava/exportava pela amostra → total
 * ERRADO (ex.: 10 de 70). Aqui o modelo só descreve as condições; o servidor
 * aplica em todas as linhas, devolve o total EXATO + amostra + o id do
 * subconjunto (`resultado_em`) para exportar exato via `gerar_relatorio`.
 */
export function buildQueryTool(datasets: DatasetRegistry): ToolSet {
  return {
    consultar_registros: tool({
      description:
        "FILTRA/consulta os registros de uma tabela JÁ COLETADA (todas as páginas). Use SEMPRE que o usuário pedir um " +
        "SUBCONJUNTO ou uma CONTAGEM: 'só os registros que...', 'quantos têm...', 'filtre por...', 'liste os que...', " +
        "'os que estão em aberto/pagos/de tal cliente', etc. O servidor aplica o filtro sobre 100% dos registros (NÃO " +
        "sobre a amostra do resumo) e retorna: `total` (contagem EXATA), `amostra` (algumas linhas para conferir) e " +
        "`resultado_em` (id do subconjunto). NUNCA conte nem filtre você mesmo pela amostra/TOP do resumo — é PARCIAL e dá " +
        "número errado. Para gerar o arquivo SÓ dos filtrados, chame `gerar_relatorio` com `tabela.dados_de` = o " +
        "`resultado_em` retornado. Informe o `total` real ao usuário.",
      inputSchema: z.object({
        dados_de: z.string().describe("Id da tabela coletada a consultar (ex.: 'tela1')."),
        filtros: z
          .array(
            z.object({
              coluna: z.string().describe("Nome da coluna como aparece no cabeçalho (ou 'cN')."),
              operador: z
                .enum(OPERADORES as [Operador, ...Operador[]])
                .describe(
                  "contem/nao_contem/igual/diferente/comeca/termina (texto), vazio/nao_vazio (preenchimento), " +
                    "maior/menor/maior_igual/menor_igual (número).",
                ),
              valor: z.string().optional().describe("Valor de comparação (não use em vazio/nao_vazio)."),
            }),
          )
          .describe("Condições do filtro. Vazio = todos os registros (útil só para contar/exportar tudo)."),
        combinacao: z
          .enum(["E", "OU"])
          .optional()
          .describe("E = todas as condições precisam bater (padrão); OU = qualquer uma."),
      }),
      execute: async ({ dados_de, filtros, combinacao }) => {
        const r = consultarDataset(
          datasets,
          dados_de,
          (filtros ?? []) as Filtro[],
          combinacao === "OU" ? "OU" : "E",
        );
        if (!r) return { erro: `Não encontrei a tabela "${dados_de}". Confira o id (ex.: "tela1").` };
        if (r.colunaNaoEncontrada)
          return { erro: `A coluna "${r.colunaNaoEncontrada}" não existe. Colunas disponíveis: ${r.colunas.join(", ")}.` };
        return {
          total: r.total,
          resultado_em: r.id,
          colunas: r.colunas,
          amostra: r.amostra,
          nota:
            `Filtro aplicado sobre TODOS os registros: ${r.total} correspondência(s). ` +
            (r.total === 0
              ? "Nenhum registro bate — reveja o critério com o usuário; não invente linhas."
              : `Para exportar SÓ estes ${r.total}, chame gerar_relatorio com tabela.dados_de="${r.id}". ` +
                "Mostre poucos exemplos no chat e ofereça o arquivo para o conjunto completo."),
        };
      },
    }),
  };
}
