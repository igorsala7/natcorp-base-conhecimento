import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { consultarDataset, agregarDataset, estatisticasColuna, agruparDataset, derivarColuna, classificarColuna, projetarSerie, OPERADORES, OPERACOES_LINHA, type Agregacao, type DatasetRegistry, type Filtro, type Operador, type OperacaoLinha, type Faixa, type MetodoProjecao } from "./datasets";

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
                `chame agregar_valores com dados_de="${r.id}". Se ele quiser um GRÁFICO ou um ARQUIVO DESTE recorte, use ` +
                `este id "${r.id}" (montar_grafico/gerar_relatorio com dados_de="${r.id}") — NUNCA o da tabela da tela ` +
                `inteira, senão viria com todos os registros. NUNCA mande o usuário baixar/abrir o arquivo para obter a ` +
                "resposta que ele te pediu."),
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
        limite: z.number().int().min(1).max(2000).optional().describe("Máx. de grupos a devolver (padrão 100; use mais quando precisar de TODOS os grupos, ex.: alimentar um gráfico/arquivo)."),
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
    derivar_coluna: tool({
      description:
        "Cria uma COLUNA CALCULADA por LINHA sobre 100% dos registros de uma tabela já coletada — a conta que as demais " +
        "ferramentas NÃO fazem (elas reduzem uma coluna a UM número ou filtram por constante). Use SEMPRE que o usuário " +
        "pedir para comparar/operar DUAS colunas linha a linha: diferença entre 'Valor Mês 2' e 'Valor Mês 1', variação % " +
        "mês a mês, % de uma coluna sobre outra, peso de cada linha no total. `operacao`: subtracao (a−b), soma, " +
        "multiplicacao, divisao, variacao_percentual ((a−b)÷b×100), percentual (a÷b×100), percentual_do_total (a÷Σa×100). " +
        "`coluna_b` = outra coluna OU um número fixo (não usar em percentual_do_total). O servidor calcula cada linha " +
        "(célula vazia/não-numérica = 0, reportado; base zero = N/A, reportado) e devolve `dados_de` com a coluna nova. " +
        "DEPOIS chame estatisticas/consultar_registros/agrupar/montar_grafico/gerar_relatorio NESSE id para " +
        "perfilar/rankear/filtrar (ex.: quedas > 20%)/gráfico/exportar sobre os 100%. É PROIBIDO calcular linha a linha de " +
        "cabeça pela amostra — o número exato sai daqui.",
      inputSchema: z.object({
        dados_de: z.string().describe("Id da tabela coletada (ex.: 'tela1')."),
        coluna_a: z.string().describe("1ª coluna (ex.: 'Valor Mês 2'), como no cabeçalho ou 'cN'."),
        operacao: z.enum(OPERACOES_LINHA as [OperacaoLinha, ...OperacaoLinha[]]),
        coluna_b: z.string().optional().describe("2ª coluna (ex.: 'Valor Mês 1') OU um número fixo. Dispensada em percentual_do_total."),
        nome_coluna: z.string().optional().describe("Nome da coluna criada (opcional; há um padrão claro)."),
      }),
      execute: async ({ dados_de, coluna_a, operacao, coluna_b, nome_coluna }) => {
        const r = derivarColuna(datasets, dados_de, coluna_a, operacao as OperacaoLinha, coluna_b, nome_coluna);
        if (!r) return { erro: `Não encontrei a tabela "${dados_de}". Confira o id (ex.: "tela1").` };
        if (r.colunaNaoEncontrada)
          return { erro: `"${r.colunaNaoEncontrada}" não é uma coluna nem um número. Colunas: ${r.colunas.join(", ")}.` };
        return {
          dados_de: r.id,
          coluna_criada: r.coluna,
          total: r.total,
          calculadas: r.calculadas,
          vazias_tratadas_como_zero: r.vazias_como_zero,
          na_base_zero: r.base_zero_na,
          colunas: r.colunas,
          amostra: r.amostra,
          nota:
            `Coluna "${r.coluna}" calculada LINHA A LINHA sobre 100% dos ${r.total} registros, guardada em ` +
            `dados_de="${r.id}" (precisão total; a amostra exibe 2 casas). ` +
            (r.vazias_como_zero ? `${r.vazias_como_zero} linha(s) tinham célula vazia/não-numérica tratada como 0. ` : "") +
            (r.base_zero_na ? `${r.base_zero_na} linha(s) ficaram N/A (base zero) — NÃO entram nas contas seguintes. ` : "") +
            `Para perfil/quedas/rankings/quantos/gráfico/arquivo desta coluna, chame estatisticas/consultar_registros/` +
            `agrupar/montar_grafico/gerar_relatorio com dados_de="${r.id}". NUNCA conte ou calcule pela amostra.`,
        };
      },
    }),
    classificar_faixa: tool({
      description:
        "RÓTULA cada registro por FAIXAS numéricas sobre 100% — use quando o usuário pedir 'aponte os de risco', 'quais " +
        "tiveram queda forte', 'separe por faixa de valor/variação'. Passe `faixas` EM ORDEM, cada uma { rotulo, min?, max? } " +
        "no intervalo [min, max) (min INCLUSIVO, max EXCLUSIVO; omita p/ limite aberto); a 1ª que casar vence. Ex. p/ variação " +
        "%: [{rotulo:'queda forte', max:-20}, {rotulo:'queda leve', min:-20, max:0}, {rotulo:'alta', min:0}]. Célula vazia/não-" +
        "numérica vira '(sem valor)' (bucket à parte, nunca cai numa faixa). Devolve a DISTRIBUIÇÃO exata + um novo dados_de " +
        "com a coluna de rótulo; depois use consultar_registros/gerar_relatorio nesse id p/ listar/exportar uma faixa.",
      inputSchema: z.object({
        dados_de: z.string().describe("Id da tabela (ex.: 'tela1' ou o resultado de derivar_coluna)."),
        coluna: z.string().describe("Coluna numérica a classificar (ex.: 'Variação %')."),
        faixas: z
          .array(
            z.object({
              rotulo: z.string().describe("Nome da faixa (ex.: 'queda forte')."),
              min: z.number().nullable().optional().describe("Mínimo INCLUSIVO (omita/null = sem limite inferior)."),
              max: z.number().nullable().optional().describe("Máximo EXCLUSIVO (omita/null = sem limite superior)."),
            }),
          )
          .min(1)
          .describe("Faixas em ordem; a 1ª que casar vence."),
        nome_coluna: z.string().optional(),
      }),
      execute: async ({ dados_de, coluna, faixas, nome_coluna }) => {
        const r = classificarColuna(datasets, dados_de, coluna, (faixas ?? []).map((f) => ({ rotulo: f.rotulo, min: f.min ?? null, max: f.max ?? null })) as Faixa[], nome_coluna);
        if (!r) return { erro: `Não encontrei a tabela "${dados_de}". Confira o id (ex.: "tela1").` };
        if (r.colunaNaoEncontrada) return { erro: `A coluna "${r.colunaNaoEncontrada}" não existe. Colunas: ${r.colunas.join(", ")}.` };
        return {
          dados_de: r.id, coluna_criada: r.coluna, total: r.total,
          distribuicao: r.distribuicao, sem_valor: r.sem_valor, colunas: r.colunas, amostra: r.amostra,
          nota:
            `Cada um dos ${r.total} registros recebeu um rótulo (100%). Distribuição EXATA acima. ` +
            (r.sem_valor ? `${r.sem_valor} sem valor numérico (bucket à parte, não entram numa faixa). ` : "") +
            `Para LISTAR/EXPORTAR os registros de uma faixa, chame consultar_registros/gerar_relatorio com dados_de="${r.id}" ` +
            `filtrando a coluna "${r.coluna}". Não conte pela amostra.`,
        };
      },
    }),
    projetar: tool({
      description:
        "PROJETA valores futuros POR REGISTRO a partir de uma SÉRIE de colunas mensais (ex.: ['Valor Mês 1','Valor Mês 2']). " +
        "Com 2 meses: calcula COMPOSTA (variação % a cada mês) e LINEAR (diferença fixa) LADO A LADO; com 3+ meses: REGRESSÃO " +
        "linear com R² por registro. `horizonte` = meses à frente (padrão 6). Determinístico e com PREMISSAS explícitas — " +
        "APRESENTE-AS ao usuário e trate como cenário, não certeza. Série incompleta (mês faltando) NÃO é projetada (reportado): " +
        "não se inventa ponto. Devolve um novo dados_de com as colunas projetadas; depois use classificar_faixa/" +
        "consultar_registros/gerar_relatorio nesse id. NUNCA projete de cabeça.",
      inputSchema: z.object({
        dados_de: z.string().describe("Id da tabela (ex.: 'tela1')."),
        colunas_serie: z.array(z.string()).min(2).describe("Colunas dos meses EM ORDEM cronológica (ex.: ['Mês 1','Mês 2'])."),
        horizonte: z.number().int().min(1).max(24).optional().describe("Meses à frente (padrão 6)."),
        metodo: z.enum(["auto", "ambos", "composta", "linear", "regressao"]).optional().describe("Padrão auto: regressão se 3+ meses, senão composta+linear."),
      }),
      execute: async ({ dados_de, colunas_serie, horizonte, metodo }) => {
        const r = projetarSerie(datasets, dados_de, colunas_serie, horizonte ?? 6, (metodo ?? "auto") as MetodoProjecao);
        if (!r) return { erro: `Não encontrei a tabela "${dados_de}". Confira o id (ex.: "tela1").` };
        if (r.erro) return { erro: r.erro };
        if (r.colunaNaoEncontrada) return { erro: `A coluna "${r.colunaNaoEncontrada}" não existe. Colunas: ${r.colunas.join(", ")}.` };
        return {
          dados_de: r.id, metodo: r.metodo, horizonte: r.horizonte, total: r.total,
          projetadas: r.projetadas, serie_incompleta: r.serie_incompleta, base_invalida_composta: r.base_invalida_composta,
          premissas: r.premissas, colunas_projetadas: r.colunas_projetadas, colunas: r.colunas, amostra: r.amostra,
          nota:
            `Projeção "${r.metodo}" de ${r.horizonte} meses sobre ${r.projetadas} de ${r.total} registros, em dados_de="${r.id}". ` +
            (r.serie_incompleta ? `${r.serie_incompleta} registro(s) NÃO projetados (série incompleta) — reporte isso. ` : "") +
            (r.base_invalida_composta ? `${r.base_invalida_composta} com base ≤ 0 na composta (N/A). ` : "") +
            `SEMPRE mostre as PREMISSAS ao usuário e trate como CENÁRIO. Para rankear/faixar/exportar, use classificar_faixa/` +
            `consultar_registros/gerar_relatorio com dados_de="${r.id}".`,
        };
      },
    }),
  };
}
