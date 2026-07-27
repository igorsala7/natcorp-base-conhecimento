/**
 * Pagina uma consulta do PostgREST até o fim, contornando o teto PADRÃO de
 * 1000 linhas por resposta.
 *
 * Por que isto existe: ao montar uma árvore (`nodes`) a partir de `parent_id`,
 * se a consulta corta em 1000 linhas, qualquer nó cujo PAI ficou de fora do
 * lote perde a referência e "sobe" para a raiz — parece que o artigo foi
 * MOVIDO para fora do diretório, sem ninguém ter mexido. A ordenação da
 * consulta precisa ser TOTAL e estável (uma chave única, ex.: `id`, como
 * desempate) para as fatias não pularem nem repetirem linhas na fronteira.
 *
 * `make(from, to)` deve devolver a MESMA consulta com `.range(from, to)`
 * aplicado (e um `.order(...)` estável). Fatias de 1000.
 */
export async function fetchAllPaged<T>(
  make: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const PAGE = 1000;
  const todas: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await make(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const lote = data ?? [];
    todas.push(...lote);
    if (lote.length < PAGE) break;
  }
  return todas;
}
