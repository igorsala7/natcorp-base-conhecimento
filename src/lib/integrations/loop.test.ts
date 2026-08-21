import { describe, it, expect } from "vitest";
import { expandirMeses, expandirValores } from "./loop";

describe("expandirMeses", () => {
  it("um único mês quando não há fim", () => {
    expect(expandirMeses("2025-03", null)).toEqual({
      lista: [{ iso: "2025-03", br: "03/2025" }],
      excedeu: false,
    });
  });

  it("intervalo inclusivo dentro do ano", () => {
    const r = expandirMeses("2025-04", "2025-09");
    expect(r.excedeu).toBe(false);
    expect(r.lista.map((m) => m.br)).toEqual(["04/2025", "05/2025", "06/2025", "07/2025", "08/2025", "09/2025"]);
  });

  it("o ano inteiro são 12 meses", () => {
    const r = expandirMeses("2025-01", "2025-12");
    expect(r.lista).toHaveLength(12);
    expect(r.lista[0]).toEqual({ iso: "2025-01", br: "01/2025" });
    expect(r.lista[11]).toEqual({ iso: "2025-12", br: "12/2025" });
  });

  it("atravessa a virada de ano", () => {
    const r = expandirMeses("2024-11", "2025-02");
    expect(r.lista.map((m) => m.br)).toEqual(["11/2024", "12/2024", "01/2025", "02/2025"]);
  });

  it("inverte quando fim vem antes do início", () => {
    const r = expandirMeses("2025-06", "2025-03");
    expect(r.lista.map((m) => m.br)).toEqual(["03/2025", "04/2025", "05/2025", "06/2025"]);
  });

  it("aceita ISO com dia (AAAA-MM-DD)", () => {
    const r = expandirMeses("2025-03-15", "2025-04-02");
    expect(r.lista.map((m) => m.iso)).toEqual(["2025-03", "2025-04"]);
  });

  it("trunca no teto e sinaliza excedeu", () => {
    const r = expandirMeses("2020-01", "2025-12", 24);
    expect(r.lista).toHaveLength(24);
    expect(r.excedeu).toBe(true);
    expect(r.lista[0]!.br).toBe("01/2020");
  });

  it("entrada inválida = lista vazia (o chamador pede o mês)", () => {
    expect(expandirMeses("", null).lista).toHaveLength(0);
    expect(expandirMeses("mês que vem", null).lista).toHaveLength(0);
    expect(expandirMeses("2025-13", null).lista).toHaveLength(0);
  });
});

describe("expandirValores", () => {
  it("separa a lista por vírgula que o modelo manda como UMA string", () => {
    // Sem isto, "205818,477" vira um valor só e o bi/v1 devolve ORA-01722.
    expect(expandirValores("205818,477")).toEqual(["205818", "477"]);
  });

  it("aceita array e separa vírgula dentro dos itens", () => {
    expect(expandirValores(["205818, 477", "69175"])).toEqual(["205818", "477", "69175"]);
  });

  it("deduplica preservando a ordem de chegada", () => {
    // Requisição repetida é paga duas vezes pelo mesmo dado.
    expect(expandirValores("477,205818,477")).toEqual(["477", "205818"]);
  });

  it("descarta vazio e espaço em branco", () => {
    // Valor vazio viraria requisição SEM filtro: volta a base inteira com
    // aparência de resposta filtrada.
    expect(expandirValores("205818, ,, 477 ")).toEqual(["205818", "477"]);
    expect(expandirValores("")).toEqual([]);
    expect(expandirValores(null)).toEqual([]);
    expect(expandirValores(undefined)).toEqual([]);
  });

  it("um valor só continua um valor só", () => {
    expect(expandirValores("205818")).toEqual(["205818"]);
    expect(expandirValores(205818)).toEqual(["205818"]);
  });
});
