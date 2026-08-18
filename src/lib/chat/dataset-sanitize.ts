/**
 * Limpa o texto que vem da TELA antes de virar dataset no Postgres.
 *
 * Caso real: uma célula do relatório trazia um byte NUL (`\u0000`) e o insert
 * quebrava inteiro — `22P05: unsupported Unicode escape sequence`, HTTP 500, e o
 * dataset não era salvo. Sem ele, as ferramentas de consulta (consultar_registros,
 * agregar_valores…) ficam sem os dados completos e a análise responde pela amostra.
 *
 * Postgres recusa NUL em `text`/`jsonb` — os demais caracteres de controle passam,
 * então tiramos só o que quebra, sem mexer no conteúdo de verdade.
 *
 * PURA e sem I/O.
 */

import { limparValorHtml } from "@/lib/integrations/html-values";

/** Remove o NUL (e os pares substitutos órfãos, que também não sobrevivem ao JSONB). */
export function limparTextoDataset(valor: string): string {
  return valor
    .replace(/\u0000/g, "")
    // Substituto solto (metade de um par UTF-16) vira caractere de substituição em vez
    // de estourar na serialização.
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, "�")
    .replace(/(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "$1�");
}

/**
 * Normaliza uma célula qualquer para texto limpo (null/undefined viram "").
 *
 * Tira TAMBÉM a marcação HTML. Endpoint e relatório montados sobre tela APEX
 * devolvem o valor já renderizado, e a lista de verbas de um recibo chega como
 * `"• Salário: R$ 19.541,50<br>• Férias no Mês: R$ 4.299,13<br>…"`. Esse `<br>`
 * atravessava o dataset e reaparecia cru na resposta ao usuário (18/08/2026).
 *
 * A limpeza já existia para o retorno das APIs de integração (`limparMarcacaoHtml`
 * no `tool-builder`), mas não para o caminho da TELA — dois portões de entrada de
 * dataset e a regra em só um deles. Aqui ela passa a valer para os dois.
 *
 * Sem teto de tamanho: o teto de `limparValorHtml` serve para não estragar um
 * documento HTML devolvido por uma API. Célula de tabela não é documento — e as
 * células longas são justamente as que carregam listas com `<br>`.
 */
export function celulaDataset(valor: unknown): string {
  return valor == null ? "" : limparValorHtml(limparTextoDataset(String(valor)), Infinity);
}
