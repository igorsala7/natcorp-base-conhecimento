/**
 * Teto do histórico enviado ao modelo.
 *
 * As três rotas de chat repassavam `payload.messages` direto para o
 * `streamText`, sem limite de quantidade nem de tamanho. Dentro do rate limit
 * de 30 req/min dava para mandar 500 mensagens de 50 KB por requisição e
 * queimar o orçamento de tokens do provedor — o `LIMITE_PERSONA` de
 * `prompt-cascade.ts` protegia só o system prompt.
 *
 * Módulo puro (sem `server-only`) para ser testável.
 */

export type ChatMsg = { role: "user" | "assistant" | "system"; content: string };

/** Últimas mensagens mantidas. Contexto suficiente para uma conversa de suporte. */
export const MAX_MENSAGENS = 20;
/** Teto por mensagem. Pergunta de suporte não passa disso. */
export const MAX_CHARS_POR_MENSAGEM = 8_000;
/** Teto do conjunto, para 20 mensagens no limite não somarem 160 KB. */
export const MAX_CHARS_TOTAL = 24_000;

/**
 * Corta o histórico para caber nos tetos, preservando o FIM da conversa — é
 * onde está a pergunta atual e o contexto imediato.
 */
export function limitarHistorico(
  messages: unknown,
  { maxMensagens = MAX_MENSAGENS, maxChars = MAX_CHARS_POR_MENSAGEM, maxTotal = MAX_CHARS_TOTAL } = {},
): ChatMsg[] {
  if (!Array.isArray(messages)) return [];

  const validas = messages
    .filter(
      (m): m is ChatMsg =>
        !!m &&
        typeof m === "object" &&
        typeof (m as ChatMsg).content === "string" &&
        ["user", "assistant", "system"].includes((m as ChatMsg).role),
    )
    .map((m) => ({ role: m.role, content: m.content.slice(0, maxChars) }))
    .filter((m) => m.content.trim().length > 0);

  const recentes = validas.slice(-maxMensagens);

  // Do fim para o começo, para que estourar o total descarte o histórico
  // ANTIGO, nunca a pergunta atual.
  const saida: ChatMsg[] = [];
  let total = 0;
  for (let i = recentes.length - 1; i >= 0; i--) {
    const m = recentes[i]!;
    if (total + m.content.length > maxTotal && saida.length > 0) break;
    saida.unshift(m);
    total += m.content.length;
  }
  return saida;
}
