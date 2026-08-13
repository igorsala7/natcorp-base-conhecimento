import { describe, it, expect } from "vitest";
import { juntarPaginas, temMais, ehPaginaOrds } from "./paginacao";

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
