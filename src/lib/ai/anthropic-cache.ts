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

/**
 * Marca a PRIMEIRA mensagem com um breakpoint.
 *
 * Serve ao bloco de contexto de TELA, que é inserido antes do histórico: ele é
 * idêntico enquanto a pessoa não troca de tela, então `tools + system + tela`
 * vira um prefixo que casa entre os ~5 turnos de uma conversa. Sem o
 * breakpoint aqui, o único ponto de leitura fica depois do histórico inteiro e
 * a tela não é aproveitada.
 *
 * Não muta a entrada; sem contexto de tela (`enabled=false`) devolve como veio.
 */
export function withFirstCache<T>(messages: T[], enabled: boolean): T[] {
  if (!enabled || messages.length === 0) return messages;
  const out = messages.slice();
  out[0] = { ...(out[0] as object), providerOptions: ANTHROPIC_CACHE } as T;
  return out;
}

/**
 * Marca o breakpoint no fim do bloco de FERRAMENTAS.
 *
 * Por que existe: a marcação ficava na última ferramenta de INTEGRAÇÃO
 * (`tool-builder`), mas a rota monta depois dela as de formulário, visuais,
 * convite, coleta, consulta e troca de fonte. Tudo isso ficava FORA do prefixo
 * cacheado — e não é pouco: só as definições de `query-tools` têm ~21 mil
 * caracteres, `gerar_relatorio` ~1.900 tokens, `montar_grafico` ~1.050.
 *
 * Medido em produção: o modelo do loop agêntico lia só **14,2%** do prefixo do
 * cache. O corte no meio da lista é a explicação.
 *
 * INVISÍVEL AO MODELO: `providerOptions` é metadado do provedor, retirado antes
 * do payload chegar ao modelo. Mesmas ferramentas, mesma ordem, mesmo schema.
 *
 * Não muta a entrada — devolve um objeto novo, preservando a ordem das chaves
 * (a ordem importa: `tools` é o PRIMEIRO bloco do payload, e qualquer troca
 * invalida também o system e as mensagens).
 */
export function marcarCacheDeTools<T>(
  tools: Record<string, T>,
  /**
   * Ferramentas ESSENCIAIS (`always_include`). Quando elas formam um prefixo
   * CONTÍNUO no começo da lista, ganham um segundo breakpoint logo depois —
   * é o único pedaço que se repete ENTRE turnos (as demais mudam com a
   * pergunta, por top-K semântico).
   *
   * Medido: as 5 essenciais custam ~2.287 tokens, acima do mínimo cacheável de
   * 1024. E o simulador mostrou, em 13 perguntas de assuntos diferentes, que
   * elas sempre saem primeiro e na mesma ordem — por isso dá para marcar sem
   * reordenar nada.
   *
   * Se NÃO forem um prefixo contínuo, o segundo breakpoint é omitido em vez de
   * a lista ser reordenada: `tools` é o primeiro bloco do payload, e mexer na
   * ordem invalidaria o cache de tools, de system E de mensagens de uma vez.
   */
  estaveis?: readonly string[],
): Record<string, T> {
  const chaves = Object.keys(tools);
  if (chaves.length === 0) return tools;

  const marcar = new Set<string>([chaves[chaves.length - 1]!]);

  // Segundo breakpoint no FIM DO BLOCO ESTÁVEL — o pedaço que se repete entre
  // turnos. Antes isto olhava as ferramentas ESSENCIAIS e exigia que elas
  // formassem prefixo contínuo; como a lista era montada na ordem do catálogo,
  // elas nunca formavam, e o breakpoint era omitido em silêncio. Agora quem
  // chama garante o prefixo (ver a ordem em `allToolsCru`), e a verificação
  // continua aqui porque um breakpoint no meio de um bloco que muda não cacheia
  // nada — só gasta um dos quatro que a Anthropic permite.
  const est = new Set((estaveis ?? []).filter((k) => k in tools));
  if (est.size > 0 && est.size < chaves.length) {
    const prefixoContinuo = chaves.slice(0, est.size).every((k) => est.has(k));
    if (prefixoContinuo) marcar.add(chaves[est.size - 1]!);
  }

  const out: Record<string, T> = {};
  for (const k of chaves) {
    out[k] = marcar.has(k) ? ({ ...(tools[k] as object), providerOptions: ANTHROPIC_CACHE } as T) : tools[k]!;
  }
  return out;
}
