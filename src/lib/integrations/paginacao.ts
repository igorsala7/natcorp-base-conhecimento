/**
 * PAGINAÇÃO DO ORDS — o resultado que parecia completo e não era.
 *
 * O ORDS pagina por padrão: devolve `{ items: [...25], hasMore: true, limit,
 * offset }`. Quem lê só `items` recebe **25 registros** e não tem como saber que
 * havia mais — e a resposta seguinte conta, soma e conclui sobre um pedaço.
 *
 * Isso é pior que um erro: um erro aparece. Aqui a conta simplesmente sai
 * errada, com cara de certa. Foi relatado como "tem resultado limitando a 25
 * registros" (13/08/2026); o `module-sync` já seguia as páginas por conta
 * própria, mas o motor de ferramentas não.
 *
 * Puro e sem IO: a busca é injetada, para dar para testar sem rede.
 */

export type PaginaOrds = {
  items?: unknown[];
  hasMore?: boolean;
  limit?: number;
  offset?: number;
  count?: number;
};

/**
 * Teto de páginas por chamada. Existe porque uma consulta sem filtro numa base
 * grande viraria centenas de idas ao ERP dentro de UM turno de chat — e o custo
 * disso não aparece para quem perguntou.
 *
 * Ao bater no teto o resultado NÃO é silencioso: vai `_truncado`, e o prompt
 * manda a IA dizer que a lista está incompleta. Recusar-se a truncar seria
 * derrubar o turno; truncar em silêncio seria mentir.
 */
export const MAX_PAGINAS = 20;
export const MAX_ITENS = 5000;

export function ehPaginaOrds(d: unknown): d is PaginaOrds {
  return !!d && typeof d === "object" && Array.isArray((d as PaginaOrds).items);
}

/** A resposta declara que existe mais além do que veio? */
export function temMais(d: unknown): boolean {
  return ehPaginaOrds(d) && (d as PaginaOrds).hasMore === true;
}

/**
 * Segue as páginas até acabar (ou até o teto), juntando `items`.
 *
 * `buscar(offset)` devolve a página daquele deslocamento — ou `null` quando a
 * requisição falha. Uma falha no meio do caminho NÃO descarta o que já veio:
 * devolve o acumulado marcado como truncado, porque metade dos dados rotulada
 * como metade vale mais que um erro.
 */
export async function juntarPaginas(
  primeira: PaginaOrds,
  buscar: (offset: number) => Promise<PaginaOrds | null>,
): Promise<{ items: unknown[]; paginas: number; truncado: boolean }> {
  const items = [...(primeira.items ?? [])];
  let atual: PaginaOrds = primeira;
  let paginas = 1;

  while (atual.hasMore === true && paginas < MAX_PAGINAS && items.length < MAX_ITENS) {
    // O `offset` da próxima página é quantos itens já temos. Preferir isso a
    // `offset + limit` do payload: se uma página vier menor que o `limit` (o
    // ORDS faz isso na última), somar o limit puraria itens.
    const proxima = await buscar(items.length);
    if (!proxima) return { items, paginas, truncado: true };
    const novos = proxima.items ?? [];
    // Página vazia com `hasMore` verdadeiro existe e seria laço infinito.
    if (novos.length === 0) return { items, paginas, truncado: false };
    items.push(...novos);
    atual = proxima;
    paginas += 1;
  }

  return {
    items: items.slice(0, MAX_ITENS),
    paginas,
    truncado: atual.hasMore === true || items.length > MAX_ITENS,
  };
}
