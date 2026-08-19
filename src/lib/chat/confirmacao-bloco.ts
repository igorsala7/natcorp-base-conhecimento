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
  if (!r.ok) {
    return [
      "## AÇÃO NÃO CONCLUÍDA",
      `O usuário confirmou "${r.nome}", mas o sistema NÃO conseguiu concluir. Não chame ferramenta`,
      "nenhuma neste turno. Diga com franqueza o que falhou e o que a pessoa pode fazer a seguir,",
      "usando SOMENTE o que está abaixo — não invente que deu certo.",
      "",
      "```json",
      corpo,
      "```",
    ].join("\n");
  }
  /**
   * O SUCESSO É AFIRMADO AQUI, não deduzido do JSON.
   *
   * A versão anterior entregava um bloco único com o retorno cru e a ressalva "se
   * houver falha, diga o que falhou". Quando a API respondia sem corpo (o caso do
   * envio de e-mail: 202 sem payload), o modelo lia `{}`, não achava prova de
   * sucesso e — obedecendo a ressalva — dizia ao usuário que "o sistema não permite
   * enviar e-mail", DEPOIS de o e-mail ter sido enviado. Medido em 17/08/2026.
   *
   * Quem sabe se deu certo é o servidor, que executou. O modelo só redige.
   */
  const vazio = corpo === "{}" || corpo === "null" || corpo === "[]";
  return [
    "## AÇÃO JÁ EXECUTADA COM SUCESSO",
    `O usuário confirmou e o sistema JÁ executou "${r.nome}" — e a execução DEU CERTO.`,
    "Não chame ferramenta nenhuma neste turno: a ação está feita, e repeti-la duplicaria o registro.",
    "",
    "Confirme a conclusão para a pessoa, com as palavras dela. NUNCA diga que não foi possível,",
    "que você não tem permissão ou que ela precisa fazer manualmente — isso já aconteceu.",
    vazio
      ? "A API concluiu sem devolver detalhes (é o normal nesta ação). Confirme que foi feito, sem inventar\nprotocolo, horário ou destinatário que não estejam na conversa."
      : "Cite os detalhes do retorno abaixo (protocolo, situação, avisos) e nada além deles:",
    ...(vazio ? [] : ["", "```json", corpo, "```"]),
  ].join("\n");
}
