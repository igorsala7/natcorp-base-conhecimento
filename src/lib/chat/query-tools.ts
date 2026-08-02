import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { consultarDataset, agregarDataset, estatisticasColuna, agruparDataset, OPERADORES, type Agregacao, type DatasetRegistry, type Filtro, type Operador } from "./datasets";

/** Operações de agregação por coluna (mesmas do motor). */
const OPS_AGREGACAO = ["soma", "media", "mediana", "min", "max", "amplitude", "variancia", "desvio_padrao", "moda", "contar", "distintos"] as const;
const filtrosSchema = z
  .array(
    z.object({
      coluna: z.string(),
      operador: z.enum(OPERADORES as [Operador, ...Operador[]]),
      valor: z.string().optional(),
    }),
  )
  .optional()
  .describe("Filtro OPCIONAL aplicado ANTES de calcular (ex.: só os 'pagos').");

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
              : `Filtro sobre 100% dos registros: RESPONDA no chat a pergunta do usuário com este total (${r.total}) e o ` +
                `recorte/análise que ele pediu — a tarefa é sua. Para SOMAR/MÉDIA/MAIOR/MENOR de uma coluna deste recorte, ` +
                `chame agregar_valores com dados_de="${r.id}". Só se ele quiser a LISTA completa das ${r.total} linhas ` +
                `em arquivo, chame gerar_relatorio com tabela.dados_de="${r.id}" (EXTRA opcional). NUNCA mande o usuário ` +
                "baixar/abrir o arquivo para obter a resposta que ele te pediu."),
        };
      },
    }),
    agregar_valores: tool({
      description:
        "Calcula UM agregado EXATO de uma COLUNA sobre 100% dos registros de uma tabela JÁ COLETADA (não pela amostra), com " +
        "filtro OPCIONAL. `operacao`: soma (total/somatória), media, mediana, min (menor), max (maior), amplitude (máx−mín), " +
        "variancia, desvio_padrao, moda (mais frequente), contar (nº de linhas), distintos (valores únicos). USE SEMPRE que o " +
        "usuário pedir somar/total, média/mediana, maior/menor, desvio, quantos — INCLUSIVE com MILHÕES de linhas. É PROIBIDO " +
        "calcular de cabeça pela amostra, dizer que 'é muito grande' ou pedir para o usuário baixar e fazer. Para o PERFIL " +
        "completo (tudo de uma vez) use `estatisticas`; para X POR categoria use `agrupar`. Números em R$/pt-BR (1.234,56).",
      inputSchema: z.object({
        dados_de: z.string().describe("Id da tabela coletada (ex.: 'tela1') ou o `resultado_em` de um filtro."),
        coluna: z.string().describe("Coluna a agregar, como no cabeçalho (ou 'cN')."),
        operacao: z.enum(OPS_AGREGACAO),
        filtros: filtrosSchema,
        combinacao: z.enum(["E", "OU"]).optional().describe("E = todas as condições (padrão); OU = qualquer uma."),
      }),
      execute: async ({ dados_de, coluna, operacao, filtros, combinacao }) => {
        const r = agregarDataset(datasets, dados_de, coluna, operacao as Agregacao, (filtros ?? []) as Filtro[], combinacao === "OU" ? "OU" : "E");
        if (!r) return { erro: `Não encontrei a tabela "${dados_de}". Confira o id (ex.: "tela1").` };
        if (r.colunaNaoEncontrada) return { erro: `A coluna "${r.colunaNaoEncontrada}" não existe.` };
        const numerico = operacao !== "contar" && operacao !== "distintos";
        return {
          operacao: r.operacao,
          coluna: r.coluna,
          valor: r.valor,
          valor_formatado: r.valor.toLocaleString("pt-BR", { maximumFractionDigits: 4 }),
          linhas_consideradas: r.linhasConsideradas,
          ...(numerico ? { valores_numericos: r.valoresNumericos, ignorados_nao_numericos: r.ignorados } : {}),
          nota:
            `Resultado EXATO sobre ${r.linhasConsideradas} registro(s) — 100% do dataset` +
            (filtros && filtros.length ? " (após o filtro)" : "") +
            ". INFORME este número ao usuário; não recalcule pela amostra." +
            (numerico && r.valoresNumericos === 0
              ? " ATENÇÃO: nenhum valor numérico nesta coluna — confirme com o usuário se a coluna está certa."
              : numerico && r.ignorados
                ? ` (${r.ignorados} célula(s) não-numérica(s) ignoradas no cálculo.)`
                : ""),
        };
      },
    }),
    estatisticas: tool({
      description:
        "PERFIL ESTATÍSTICO COMPLETO de uma coluna numérica, de uma vez, sobre 100% dos registros (com filtro opcional): " +
        "contagem, válidos, distintos, soma, média, mediana, moda, mínimo, máximo, amplitude, variância, desvio-padrão e " +
        "percentis (p25/p75/p90/p95/p99). Use quando o usuário pedir 'estatísticas', 'análise estatística', 'distribuição', " +
        "'resumo dos números' de uma coluna — INCLUSIVE com milhões de linhas. Tudo EXATO; números em R$/pt-BR.",
      inputSchema: z.object({
        dados_de: z.string().describe("Id da tabela coletada (ex.: 'tela1')."),
        coluna: z.string().describe("Coluna numérica a perfilar."),
        filtros: filtrosSchema,
        combinacao: z.enum(["E", "OU"]).optional(),
      }),
      execute: async ({ dados_de, coluna, filtros, combinacao }) => {
        const r = estatisticasColuna(datasets, dados_de, coluna, (filtros ?? []) as Filtro[], combinacao === "OU" ? "OU" : "E");
        if (!r) return { erro: `Não encontrei a tabela "${dados_de}".` };
        if (r.colunaNaoEncontrada) return { erro: `A coluna "${r.colunaNaoEncontrada}" não existe.` };
        return {
          coluna: r.coluna,
          linhas: r.linhas,
          valores_numericos: r.validos,
          ignorados_nao_numericos: r.ignorados,
          distintos: r.distintos,
          soma: r.soma, media: r.media, mediana: r.mediana, moda: r.moda,
          minimo: r.min, maximo: r.max, amplitude: r.amplitude,
          variancia: r.variancia, desvio_padrao: r.desvio_padrao,
          percentis: { p25: r.p25, p75: r.p75, p90: r.p90, p95: r.p95, p99: r.p99 },
          nota:
            `Tudo EXATO sobre ${r.validos} valor(es) numérico(s) de ${r.linhas} linha(s) — 100% do dataset. ` +
            (r.validos === 0 ? "ATENÇÃO: nenhum valor numérico — confirme a coluna com o usuário." : "Apresente os que o usuário pediu; formate em pt-BR."),
        };
      },
    }),
    agrupar: tool({
      description:
        "AGRUPA POR uma coluna (ou DUAS, em cruzamento) e agrega OUTRA — ex.: soma de Valor por Status, média de Salário por " +
        "Departamento, contagem por Cidade, contagem por Empresa E Filial. `operacao`: soma/media/mediana/min/max/desvio_padrao/" +
        "amplitude ou 'contar' (aí `coluna_valor` é ignorada). Para '… por X E Y' (dois níveis/cruzamento), passe `coluna_grupo2` " +
        "— vira UMA chamada exata; NÃO chame agrupar duas vezes. Sobre 100% dos registros, com filtro opcional. Devolve os grupos " +
        "ordenados pelo valor (maior→menor).",
      inputSchema: z.object({
        dados_de: z.string().describe("Id da tabela coletada (ex.: 'tela1')."),
        coluna_grupo: z.string().describe("Coluna pela qual AGRUPAR (a categoria)."),
        coluna_grupo2: z.string().optional().describe("2ª coluna de agrupamento p/ CRUZAMENTO (ex.: 'por empresa E filial'). Combina as duas numa passada."),
        coluna_valor: z.string().optional().describe("Coluna a agregar (obrigatória, exceto quando operacao='contar')."),
        operacao: z.enum(["soma", "media", "mediana", "min", "max", "amplitude", "desvio_padrao", "contar"]),
        filtros: filtrosSchema,
        combinacao: z.enum(["E", "OU"]).optional(),
        limite: z.number().int().min(1).max(500).optional().describe("Máx. de grupos a devolver (padrão 100)."),
      }),
      execute: async ({ dados_de, coluna_grupo, coluna_grupo2, coluna_valor, operacao, filtros, combinacao, limite }) => {
        const r = agruparDataset(datasets, dados_de, coluna_grupo, coluna_valor ?? coluna_grupo, operacao as Agregacao, (filtros ?? []) as Filtro[], combinacao === "OU" ? "OU" : "E", limite ?? 100, coluna_grupo2);
        if (!r) return { erro: `Não encontrei a tabela "${dados_de}".` };
        if ("colunaNaoEncontrada" in r) return { erro: `A coluna "${r.colunaNaoEncontrada}" não existe.` };
        return {
          operacao,
          total_grupos: r.totalGrupos,
          grupos: r.grupos.map((g) => ({ grupo: g.grupo, valor: g.valor, valor_formatado: g.valor.toLocaleString("pt-BR", { maximumFractionDigits: 4 }), linhas: g.linhas })),
          nota:
            `EXATO sobre 100% dos registros, ${r.totalGrupos} grupo(s)` +
            (r.grupos.length < r.totalGrupos ? ` (mostrando os ${r.grupos.length} maiores)` : "") +
            ". Apresente os grupos ao usuário.",
        };
      },
    }),
    calcular: tool({
      description:
        "Calculadora EXATA para combinar números (ex.: dividir a soma de A pela soma de B, %, potência). `operacao`: somar, " +
        "subtrair, multiplicar, dividir, potencia (a elevado a b), percentual (a÷b×100) ou variacao_percentual ((a−b)÷b×100). " +
        "Use para divisão/multiplicação/potência/percentual entre valores EXATOS (ex.: os que vieram de agregar_valores/" +
        "estatisticas) em vez de calcular de cabeça — garante consistência.",
      inputSchema: z.object({
        operacao: z.enum(["somar", "subtrair", "multiplicar", "dividir", "potencia", "percentual", "variacao_percentual"]),
        a: z.number(),
        b: z.number(),
      }),
      execute: async ({ operacao, a, b }) => {
        let valor: number; let formula: string;
        switch (operacao) {
          case "somar": valor = a + b; formula = `${a} + ${b}`; break;
          case "subtrair": valor = a - b; formula = `${a} − ${b}`; break;
          case "multiplicar": valor = a * b; formula = `${a} × ${b}`; break;
          case "dividir": if (b === 0) return { erro: "Divisão por zero." }; valor = a / b; formula = `${a} ÷ ${b}`; break;
          case "potencia": valor = a ** b; formula = `${a} ^ ${b}`; break;
          case "percentual": if (b === 0) return { erro: "Base zero: não dá para calcular o percentual." }; valor = (a / b) * 100; formula = `${a} ÷ ${b} × 100`; break;
          case "variacao_percentual": if (b === 0) return { erro: "Base zero: não dá para calcular a variação." }; valor = ((a - b) / b) * 100; formula = `(${a} − ${b}) ÷ ${b} × 100`; break;
          default: return { erro: "Operação desconhecida." };
        }
        if (!Number.isFinite(valor)) return { erro: "Resultado inválido (overflow/indefinido)." };
        const pct = operacao === "percentual" || operacao === "variacao_percentual";
        return {
          operacao, formula, valor,
          valor_formatado: valor.toLocaleString("pt-BR", { maximumFractionDigits: 4 }) + (pct ? "%" : ""),
          nota: "Resultado EXATO. Informe ao usuário.",
        };
      },
    }),
  };
}
