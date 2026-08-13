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
  /** ORDS publica a próxima página aqui — é o caminho canônico e o mais confiável. */
  links?: { rel?: string; href?: string }[];
};

/**
 * URL da próxima página, quando o próprio ORDS a publica.
 *
 * Preferir isto a montar `offset=` na mão: o endpoint pode paginar por cursor,
 * usar outro nome de parâmetro, ou já vir com filtros que precisam ser
 * preservados. Seguir o `href` que ele mesmo deu acerta em todos esses casos.
 */
export function proximaPagina(d: unknown): string | null {
  if (!ehPaginaOrds(d)) return null;
  const l = (d as PaginaOrds).links ?? [];
  const next = l.find((x) => String(x?.rel ?? "").toLowerCase() === "next");
  const href = String(next?.href ?? "").trim();
  return href || null;
}

/**
 * Junta o `links.next` do ORDS com a ORIGEM da requisição original.
 *
 * O ORDS publica o link com o esquema e o host que ELE conhece — e num payload
 * real (13/08/2026) vinha `http://`, enquanto a chamada saiu por `https://`.
 * Seguir o href como veio rebaixaria a conexão para texto claro, levando junto a
 * chave da API (que viaja na query) e o conteúdo, que aqui inclui CPF, título de
 * eleitor e salário.
 *
 * Então do link aproveita-se o CAMINHO e a QUERY — que é a informação de
 * paginação, a única que ele tem a acrescentar. Esquema, host e porta continuam
 * sendo os da requisição que nós fizemos.
 */
export function urlDaProxima(href: string, original: string): string {
  const base = new URL(original);
  const alvo = new URL(href, original);
  alvo.protocol = base.protocol;
  alvo.host = base.host;
  return alvo.toString();
}

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

/**
 * A resposta indica que existe mais além do que veio?
 *
 * TRÊS sinais, porque o ORDS não usa um só. Depender de `hasMore` deixava de
 * fora quem publica só o `links.next`, e quem não publica nenhum dos dois — o
 * caso do handler PL/SQL que devolve `{items, limit, offset, count}` e nada
 * mais.
 *
 * O terceiro sinal (página cheia) é heurística, e de propósito: uma página com
 * exatamente `limit` itens quase sempre tem sequência. O custo de errar é UMA
 * requisição que volta vazia e encerra o laço; o custo de não tentar é a conta
 * sair errada com cara de certa.
 */
export function temMais(d: unknown): boolean {
  if (!ehPaginaOrds(d)) return false;
  const p = d as PaginaOrds;
  if (p.hasMore === true) return true;
  if (p.hasMore === false) return false; // declarou que acabou: respeita
  if (proximaPagina(d)) return true;
  const lim = Number(p.limit ?? 0);
  return lim > 0 && (p.items?.length ?? 0) >= lim;
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

  while (temMais(atual)) {
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
