import { describe, it, expect } from "vitest";
import { juntarPaginas, temMais, ehPaginaOrds, proximaPagina, urlDaProxima } from "./paginacao";

/**
 * O ORDS devolve 25 itens por página. Sem seguir `hasMore`, a consulta parecia
 * completa e não era — e a IA contava, somava e concluía sobre um pedaço.
 * Relatado como "tem resultado limitando a 25 registros" (13/08/2026).
 */
const pagina = (qtd: number, hasMore: boolean, base = 0) => ({
  items: Array.from({ length: qtd }, (_, i) => ({ id: base + i })),
  hasMore,
  limit: 25,
});

describe("ehPaginaOrds / temMais", () => {
  it("reconhece o envelope do ORDS", () => {
    expect(ehPaginaOrds({ items: [], hasMore: false })).toBe(true);
    expect(ehPaginaOrds({ dados: [] })).toBe(false);
    expect(ehPaginaOrds(null)).toBe(false);
    expect(temMais({ items: [], hasMore: true })).toBe(true);
    expect(temMais({ items: [], hasMore: false })).toBe(false);
  });
});

describe("juntarPaginas", () => {
  it("segue até acabar e junta tudo", async () => {
    const paginas = [pagina(25, true, 0), pagina(25, true, 25), pagina(7, false, 50)];
    let n = 0;
    const r = await juntarPaginas(paginas[0]!, async () => paginas[++n] ?? null);
    expect(r.items).toHaveLength(57);
    expect(r.paginas).toBe(3);
    expect(r.truncado).toBe(false);
  });

  it("pede a próxima pelo TOTAL já obtido, não por offset+limit", async () => {
    // A última página vem menor que o `limit`; somar o limit puraria itens.
    const vistos: number[] = [];
    await juntarPaginas(pagina(25, true, 0), async (offset) => {
      vistos.push(offset);
      return offset < 40 ? pagina(15, true, offset) : pagina(1, false, offset);
    });
    expect(vistos[0]).toBe(25);
    expect(vistos[1]).toBe(40);
  });

  it("uma página vazia com hasMore não vira laço infinito", async () => {
    const r = await juntarPaginas(pagina(25, true, 0), async () => pagina(0, true, 0));
    expect(r.items).toHaveLength(25);
    expect(r.truncado).toBe(false);
  });

  it("falha no meio devolve o que já veio, marcado como truncado", async () => {
    // Metade dos dados ROTULADA como metade vale mais que um erro.
    const r = await juntarPaginas(pagina(25, true, 0), async () => null);
    expect(r.items).toHaveLength(25);
    expect(r.truncado).toBe(true);
  });

  it("NÃO tem teto — traz todas as páginas", async () => {
    // Meio resultado é pior que resultado nenhum: a conta sai errada com cara de
    // certa. O que bounda a busca é o timeout da requisição, não um número aqui.
    let n = 0;
    const r = await juntarPaginas(pagina(25, true, 0), async (offset) => {
      n++;
      return n < 120 ? pagina(25, true, offset) : pagina(3, false, offset);
    });
    expect(r.paginas).toBe(121);
    expect(r.items).toHaveLength(25 + 119 * 25 + 3);
    expect(r.truncado).toBe(false);
  });

  it("servidor que ignora o offset não vira laço infinito", async () => {
    // Devolver SEMPRE a mesma página com hasMore=true encheria a memória, e o
    // total — que é justamente o que se quer proteger — sairia inflado.
    const r = await juntarPaginas(pagina(25, true, 0), async () => pagina(25, true, 0));
    expect(r.items).toHaveLength(25);
    expect(r.truncado).toBe(true);
  });

  it("página única sem hasMore nem faz segunda busca", async () => {
    let chamou = 0;
    const r = await juntarPaginas(pagina(4, false), async () => { chamou++; return null; });
    expect(chamou).toBe(0);
    expect(r.items).toHaveLength(4);
  });
});

describe("proximaPagina — o caminho que o ORDS publica", () => {
  it("acha o link rel=next", () => {
    expect(
      proximaPagina({ items: [], links: [{ rel: "self", href: "/a" }, { rel: "next", href: "/a?offset=25" }] }),
    ).toBe("/a?offset=25");
  });

  it("ignora rel diferente de next, e maiúsculas não atrapalham", () => {
    expect(proximaPagina({ items: [], links: [{ rel: "prev", href: "/x" }] })).toBeNull();
    expect(proximaPagina({ items: [], links: [{ rel: "NEXT", href: "/y" }] })).toBe("/y");
  });

  it("sem links devolve null — aí o offset é montado na mão", () => {
    expect(proximaPagina({ items: [], hasMore: true })).toBeNull();
    expect(proximaPagina(null)).toBeNull();
  });
});

describe("temMais — três sinais, porque o ORDS não usa um só", () => {
  it("hasMore explícito manda", () => {
    expect(temMais({ items: [1], hasMore: true })).toBe(true);
    // Declarou que acabou: respeita, mesmo com a página cheia.
    expect(temMais({ items: [1, 2], hasMore: false, limit: 2 })).toBe(false);
  });

  it("sem hasMore, o links.next basta", () => {
    expect(temMais({ items: [1], links: [{ rel: "next", href: "/p2" }] })).toBe(true);
  });

  it("sem hasMore e sem links, página CHEIA indica sequência", () => {
    // É o handler PL/SQL que devolve só {items, limit, offset, count}. O custo de
    // errar é uma requisição vazia; o de não tentar é a conta sair errada.
    expect(temMais({ items: [1, 2, 3], limit: 3 })).toBe(true);
    expect(temMais({ items: [1, 2], limit: 3 })).toBe(false);
  });

  it("sem sinal nenhum não inventa página", () => {
    expect(temMais({ items: [1, 2, 3] })).toBe(false);
    expect(temMais({ dados: [] })).toBe(false);
  });
});

describe("urlDaProxima — o link do ORDS não decide o esquema", () => {
  const ORIG = "https://www.natcorpbr.com.br/apex/rh/natcorp/chatbot/consultas/v1/inf?p_empresa=700&key=SEGREDO";

  it("mantém HTTPS mesmo quando o ORDS publica http", () => {
    // Real: o `links.next` vinha em http://. Segui-lo rebaixaria a conexão e
    // mandaria a chave da API e CPF/salário em texto claro.
    const u = urlDaProxima("http://www.natcorpbr.com.br/apex/rh/natcorp/chatbot/consultas/v1/inf?key=SEGREDO&offset=25", ORIG);
    expect(u.startsWith("https://")).toBe(true);
    expect(u).toContain("offset=25");
  });

  it("mantém o HOST da chamada — link não redireciona para outro domínio", () => {
    const u = urlDaProxima("https://outro.example.com/x?offset=25", ORIG);
    expect(new URL(u).host).toBe("www.natcorpbr.com.br");
    expect(u).toContain("offset=25");
  });

  it("aceita href relativo", () => {
    expect(urlDaProxima("/apex/x?offset=50", ORIG)).toBe("https://www.natcorpbr.com.br/apex/x?offset=50");
  });
});
