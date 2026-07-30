/**
 * Constantes da base de conhecimento, compartilhadas entre a tela (cliente) e
 * as Server Actions.
 *
 * Ficam num módulo PURO de propósito: um arquivo `"use server"` só pode
 * exportar funções assíncronas. Uma constante exportada de lá não atravessa a
 * fronteira como valor — o cliente recebe uma referência de action, e
 * `EXTENSOES.join(",")` estoura em tempo de execução.
 */

/** Teto de upload: um arquivo maior derrubaria a extração por memória. */
export const MAX_BYTES = 25 * 1024 * 1024;

/** Formatos aceitos — o extrator despacha por extensão. */
export const EXTENSOES = [
  ".pdf",
  ".docx",
  ".xlsx",
  ".xlsm",
  ".csv",
  ".tsv",
  ".html",
  ".htm",
  ".md",
  ".txt",
] as const;

/**
 * Valor do `accept` do <input type=file>: extensões + MIME types. Sem os MIMEs,
 * o seletor do macOS DESABILITA o .csv (em especial os salvos pelo Excel, que
 * ficam com o tipo `application/vnd.ms-excel`). O portão real é `assertArquivoSeguro`.
 */
export const ACCEPT = [
  ...EXTENSOES,
  "text/plain",
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "text/tab-separated-values",
  "text/markdown",
  "text/html",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
].join(",");

/** Rótulo legível do limite, para a tela não recalcular em dois lugares. */
export const MAX_MB = MAX_BYTES / 1024 / 1024;
