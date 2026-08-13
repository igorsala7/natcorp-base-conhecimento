/**
 * Parte PURA do turno de confirmação: o tipo do resultado e o bloco de prompt.
 *
 * Fora do módulo com `server-only` porque o teste precisa dela sem arrastar o
 * cliente admin e a validação de env — mesmo motivo do helper de origem.
 */

export type ResultadoConfirmacao = {
  tool: string;
  /** Rótulo humano da ferramenta, para o modelo citar. */
  nome: string;
  ok: boolean;
  data?: unknown;
  erro?: string;
};

/** Teto do que vai ao prompt: um retorno grande não deve reintroduzir o custo que este caminho corta. */
const MAX_CHARS = 6000;

/**
 * Bloco que o modelo recebe no lugar das ferramentas. Ele NÃO decide mais nada
 * neste turno — só conta à pessoa o que aconteceu.
 */
export function blocoConfirmacaoExecutada(r: ResultadoConfirmacao): string {
  const corpo = r.ok
    ? JSON.stringify(r.data ?? {}).slice(0, MAX_CHARS)
    : JSON.stringify({ erro: r.erro ?? "não foi possível concluir" });
  return [
    "## AÇÃO JÁ EXECUTADA",
    `O usuário confirmou e o sistema JÁ executou "${r.nome}". Não chame ferramenta nenhuma neste turno:`,
    "a ação está feita, e repeti-la duplicaria o registro.",
    "",
    "Conte o resultado com as palavras dele, usando SOMENTE o que está abaixo — número de",
    "protocolo, situação, avisos. Se houver falha, diga o que falhou e o que a pessoa pode fazer;",
    "não invente que deu certo.",
    "",
    "```json",
    corpo,
    "```",
  ].join("\n");
}
