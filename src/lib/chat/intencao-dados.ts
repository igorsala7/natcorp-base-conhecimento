/**
 * A PERGUNTA PEDE ANÁLISE DE DADOS?
 *
 * Medido no trace de 15/08/2026: a mensagem "Ocorreu um erro ao tentar processar
 * as informações" recebeu 14 ferramentas e 25.347 tokens. Dez delas eram de dados
 * — `consultar_registros`, `agregar_valores`, `estatisticas`, `agrupar`,
 * `calcular`, `derivar_coluna`, `classificar_faixa`, `projetar`,
 * `montar_grafico`, `gerar_relatorio` — enviadas num turno cujo próprio trace
 * registrava `dataset:registro {itens: [], total: 0}`. Sem uma linha sequer, não
 * havia o que consultar, agregar ou plotar: ~9.800 tokens que o modelo não tinha
 * como usar.
 *
 * O gate antigo era `temIntegTools` — "existe ferramenta de integração no turno".
 * Isso é quase sempre verdade, porque quase todo turno tem alguma. Ele respondia
 * "pode ser que venha dado", não "veio dado".
 *
 * ── Por que regex, e por que ESTA regex ─────────────────────────────────────
 * O gate por texto já foi tentado nas ferramentas visuais e revertido, porque
 * follow-up não casa: "agora em pizza" não parece pedido de gráfico. A diferença
 * aqui é que este teste **não decide sozinho** — ele entra em OU com os sinais
 * explícitos (relatório na tela, tabela na tela, anexo tabular). Quem tem dado
 * na mão continua com as ferramentas; a regex só cobre o caso de pedir número
 * sobre algo que ainda vai ser buscado.
 *
 * Puro e sem IO.
 */

/** Pedido de número, recorte ou saída visual. Deliberadamente generoso: o custo de
 *  um falso positivo é token; o de um falso negativo é o modelo sem a ferramenta. */
const RX_ANALISE =
  /\b(quant[oa]s?|total(?:iza\w*)?|soma\w*|somat\w*|m[eé]dias?|mediana|percentu\w*|porcentagem|%|maior(?:es)?|menor(?:es)?|m[aá]xim\w*|m[ií]nim\w*|top\s*\d|ranking|rankear|classifi\w*|compar\w*|evolu\w*|tend[eê]nc\w*|proje\w*|acumul\w*|distribu\w*|agrup\w*|agreg\w*|filtr\w*|list[ae]\w*|listar|relat[oó]ri\w*|planilha|csv|excel|pdf|gr[aá]fic\w*|dashboard|indicador\w*|m[eé]tric\w*|estat[ií]stic\w*|c[aá]lcul\w*|calcul\w*|valor(?:es)?\s+(?:de|do|da|total)|folha\s+de\s+pagamento|custo\s+total)\b/i;

/**
 * A pergunta pede algo que só se responde com dado tabular?
 *
 * Usada em OU com os sinais de dado presente — nunca sozinha como única porta.
 */
export function pedeAnalise(pergunta: string): boolean {
  return RX_ANALISE.test(String(pergunta ?? ""));
}
