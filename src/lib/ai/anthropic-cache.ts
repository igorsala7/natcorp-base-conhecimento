/**
 * Marca de CACHE DE PROMPT da Anthropic (prompt caching). Aplicada num ponto de
 * corte (breakpoint), faz a Anthropic reaproveitar todo o prefixo até ali —
 * ~10× mais barato — nas re-chamadas do loop agêntico (cada step reenvia
 * system + ferramentas + histórico) e entre turnos próximos (TTL de 5 min).
 *
 * Usada em dois lugares (dois breakpoints, o máximo é 4):
 *  - na ÚLTIMA ferramenta (tool-builder): cacheia o bloco de ferramentas, que é
 *    idêntico entre turnos → maior reaproveitamento;
 *  - na ÚLTIMA mensagem da entrada (rotas de chat): cacheia system + histórico
 *    dentro do mesmo turno multi-step.
 *
 * `providerOptions.anthropic` é IGNORADO por OpenAI/Google — seguro deixar
 * sempre. Não reduz a CONTAGEM de tokens exibida (a SDK soma os de cache no
 * total), só o CUSTO real.
 */
export const ANTHROPIC_CACHE = {
  anthropic: { cacheControl: { type: "ephemeral" as const } },
} as const;

/**
 * Marca a ÚLTIMA mensagem com o breakpoint de cache (quando `enabled`) — cacheia
 * system + histórico do turno. Só compensa quando há ferramentas (prefixo grande
 * e re-chamado); sem elas, `enabled=false` deixa tudo como está. Não muta a
 * entrada.
 */
export function withPrefixCache<T>(messages: T[], enabled: boolean): T[] {
  if (!enabled || messages.length === 0) return messages;
  const out = messages.slice();
  out[out.length - 1] = { ...(out[out.length - 1] as object), providerOptions: ANTHROPIC_CACHE } as T;
  return out;
}
