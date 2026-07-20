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
  ".html",
  ".htm",
  ".md",
  ".txt",
] as const;

/** Rótulo legível do limite, para a tela não recalcular em dois lugares. */
export const MAX_MB = MAX_BYTES / 1024 / 1024;
