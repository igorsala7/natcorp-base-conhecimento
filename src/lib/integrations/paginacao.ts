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
 * SEM TETO de páginas ou de itens — decisão do produto (Igor, 13/08/2026), e a
 * arquitetura a sustenta: o resultado inteiro fica no registro de datasets e só
 * uma AMOSTRA vai ao modelo, então trazer tudo não custa token. Meio resultado é
 * pior que resultado nenhum, porque a conta sai errada com cara de certa.
 *
 * O que bounda a busca é o TIMEOUT da requisição, que já existe: quando ele
 * dispara, a página falha, e o acumulado volta marcado como truncado.
 *
 * O que sobrou não é limite, é defesa contra servidor que MENTE: um endpoint
 * que ignore o `offset` e devolva sempre a mesma página com `hasMore: true`
 * encheria a memória para sempre. Duas páginas idênticas seguidas encerram.
 */

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
  let assinaturaAnterior = assinatura(primeira.items ?? []);

  while (atual.hasMore === true) {
    // O `offset` da próxima página é quantos itens já temos. Preferir isso a
    // `offset + limit` do payload: se uma página vier menor que o `limit` (o
    // ORDS faz isso na última), somar o limit pularia itens.
    const proxima = await buscar(items.length);
    // Falha no meio (inclusive por timeout): devolve o acumulado ROTULADO como
    // incompleto. Metade dos dados dita como metade vale mais que um erro.
    if (!proxima) return { items, paginas, truncado: true };

    const novos = proxima.items ?? [];
    // Página vazia com `hasMore` verdadeiro existe, e seria laço infinito.
    if (novos.length === 0) return { items, paginas, truncado: false };

    // Servidor que ignora o `offset` devolve a MESMA página para sempre. Sem
    // esta parada, a lista cresceria com duplicatas até a memória acabar — e o
    // total, que é justamente o que se quer proteger, sairia inflado.
    const assinaturaAtual = assinatura(novos);
    if (assinaturaAtual === assinaturaAnterior) return { items, paginas, truncado: true };
    assinaturaAnterior = assinaturaAtual;

    items.push(...novos);
    atual = proxima;
    paginas += 1;
  }

  return { items, paginas, truncado: false };
}

/** Identidade barata de uma página, para detectar repetição. */
function assinatura(itens: unknown[]): string {
  return `${itens.length}:${JSON.stringify(itens[0] ?? null)}:${JSON.stringify(itens[itens.length - 1] ?? null)}`;
}
