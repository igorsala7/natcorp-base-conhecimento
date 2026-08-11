/**
 * Texto-fonte do EMBEDDING de uma ferramenta — puro, sem server-only nem IO.
 *
 * Separado de `tool-catalog.ts` (que importa a config de IA) para ser testável
 * direto, no mesmo padrão de `ontology-enrich.ts`.
 */

/**
 * Remove as frases de ORQUESTRAÇÃO — as que citam OUTRA ferramenta pelo nome.
 *
 * Elas são instrução para o modelo ("Consulte `historico_financeiro_meses` para os
 * meses válidos"), não descrição do que a ferramenta faz. No vetor, viram ruído que
 * rouba a pergunta da ferramenta certa: a de RECIBO DE PAGAMENTO carregava a string
 * "historico_financeiro_meses" e por isso vencia um pedido de "histórico financeiro"
 * — sem que a descrição dela falasse de histórico financeiro em nenhum momento.
 *
 * O corte é por FRASE, não por palavra: apagar só a chave deixaria "Consulte  para
 * os meses válidos", que continua puxando o vetor para o assunto errado.
 *
 * Só afeta o EMBEDDING. O texto entregue ao modelo continua íntegro — a orquestração
 * é justamente o que o faz encadear as chamadas na ordem certa.
 */
export function semOrquestracao(texto: string, chavesDeOutras: Set<string>): string {
  const t = String(texto ?? "");
  if (!t.trim() || !chavesDeOutras.size) return t;
  return t
    .split(/(?<=[.!?;])\s+/)
    .filter((frase) => {
      // `\w` inclui `_`, então a fronteira não quebra dentro de `historico_financeiro`.
      const tokens = frase.toLowerCase().match(/[a-z0-9_]{4,}/g) ?? [];
      return !tokens.some((tk) => chavesDeOutras.has(tk));
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Texto canônico embedado por tool (e reusado para embedar a mensagem do usuário). */
export function toolCatalogText(
  name: string,
  description: string,
  extra?: { searchTerms?: string | null; responseHint?: string | null; chavesDeOutras?: Set<string> },
): string {
  const limpar = (s: string | null | undefined) =>
    extra?.chavesDeOutras ? semOrquestracao(String(s ?? ""), extra.chavesDeOutras) : String(s ?? "");
  // Sinônimos/exemplos (search_terms) e o que a tool RETORNA (response_hint) enriquecem
  // o embedding — o matching semântico passa a entender o vocabulário do usuário.
  //
  // O teto era 2000 e o corte cai no FIM — justamente onde ficam os sinônimos, que
  // são a parte mais valiosa para o casamento (e a porta de entrada dos conceitos da
  // ontologia). Uma tool já estourava. 4000 é o mesmo teto do vetor por base e cabe
  // folgado na janela do modelo de embedding.
  // `name` e `search_terms` ficam intactos: são o vocabulário da tool, não orquestração.
  return [name, limpar(description), extra?.searchTerms, limpar(extra?.responseHint)]
    .map((s) => String(s ?? "").trim())
    .filter(Boolean)
    .join(" — ")
    .slice(0, 4000);
}

/**
 * Qual vetor usar para a ferramenta entrar no catálogo de seleção.
 *
 * O vetor POR BASE (enriquecido com a ontologia do cliente) tem preferência; o
 * GLOBAL é o fallback. A versão anterior tratava o global como PRÉ-REQUISITO —
 * `if (!global) return []` descartava a ferramenta antes de olhar o da base —,
 * o que contradizia o próprio comentário do código.
 *
 * Não é hipótese: as 10 ferramentas Microsoft (enviar e-mail, ver agenda, criar
 * evento) tinham vetor por base nas 3 bases e nenhum global. Sumiam do catálogo,
 * ficavam sem similaridade, e o top-K nunca as escolhia. O sintoma que chegou
 * foi "os comandos da conta Microsoft não funcionam no chat" — três camadas
 * longe da causa.
 *
 * Devolve `null` quando não há vetor nenhum: aí a ferramenta sai do catálogo com
 * razão, porque não há como pontuá-la.
 */
export function escolherVetor(
  global: number[] | null | undefined,
  porBase: number[] | null | undefined,
): number[] | null {
  if (global?.length) return global;
  if (porBase?.length) return porBase;
  return null;
}
