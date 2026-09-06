import { describe, it, expect } from "vitest";
import { compactarLinhas, notaCompactacao } from "./compactar-linhas";

/** Forma real de `informacoes_pessoais_funcionais_resumido` (campos reduzidos). */
const pessoas = [
  { cod_empresa: 700, nome_empresa: "NATCORP DO BRASIL", matricula: 1864, nome: "Bruno", nome_social: null, cod_un_negocio: null, salario: 2592.56 },
  { cod_empresa: 700, nome_empresa: "NATCORP DO BRASIL", matricula: 2321, nome: "Samuel", nome_social: null, cod_un_negocio: null, salario: 3231.38 },
  { cod_empresa: 700, nome_empresa: "NATCORP DO BRASIL", matricula: 19127, nome: "Vera", nome_social: null, cod_un_negocio: null, salario: 1621 },
];

describe("compactarLinhas", () => {
  it("fatora o campo que não muda e remove o que veio vazio", () => {
    const c = compactarLinhas(pessoas)!;
    expect(c.comum).toEqual({ cod_empresa: 700, nome_empresa: "NATCORP DO BRASIL" });
    expect(c.vazios.sort()).toEqual(["cod_un_negocio", "nome_social"]);
    expect(c.linhas).toEqual([
      { matricula: 1864, nome: "Bruno", salario: 2592.56 },
      { matricula: 2321, nome: "Samuel", salario: 3231.38 },
      { matricula: 19127, nome: "Vera", salario: 1621 },
    ]);
    expect(c.bytesDepois).toBeLessThan(c.bytesAntes);
  });

  it("encolhe de verdade — é o ponto todo", () => {
    const c = compactarLinhas(pessoas)!;
    expect(c.bytesDepois / c.bytesAntes).toBeLessThan(0.75);
  });

  /**
   * Com 1 ou 2 linhas todo campo é "constante" e fatorar só move bytes de
   * lugar. O piso existe para a compactação nunca ser um custo.
   */
  it("não age abaixo do piso de linhas", () => {
    expect(compactarLinhas(pessoas.slice(0, 1))).toBeNull();
    expect(compactarLinhas(pessoas.slice(0, 2))).toBeNull();
  });

  it("não age quando não há nada redundante", () => {
    expect(compactarLinhas([{ a: 1 }, { a: 2 }, { a: 3 }])).toBeNull();
  });

  /**
   * Se tudo é constante, as linhas virariam `{}` e o modelo perderia a noção de
   * que há N registros distintos. Prefere não mexer.
   */
  it("não esvazia a linha", () => {
    expect(compactarLinhas([{ a: 1 }, { a: 1 }, { a: 1 }])).toBeNull();
  });

  /**
   * Campo AUSENTE em uma das linhas não é constante nem vazio: a ausência
   * distingue os registros e tem de sobreviver.
   */
  it("não fatora campo que falta em alguma linha", () => {
    const c = compactarLinhas([
      { a: 1, b: "x", so_na_1: true },
      { a: 2, b: "x" },
      { a: 3, b: "x" },
    ])!;
    expect(c.comum).toEqual({ b: "x" });
    expect(c.linhas[0]).toEqual({ a: 1, so_na_1: true });
  });

  it("trata null, undefined e string vazia como o mesmo vazio", () => {
    const c = compactarLinhas([
      { id: 1, obs: null, x: 1 },
      { id: 2, obs: undefined, x: 2 },
      { id: 3, obs: "", x: 3 },
    ])!;
    expect(c.vazios).toEqual(["obs"]);
  });

  it("ignora entrada que não é lista de objetos", () => {
    expect(compactarLinhas([1, 2, 3])).toBeNull();
    expect(compactarLinhas([{ a: 1 }, "x", { a: 2 }])).toBeNull();
    expect(compactarLinhas([])).toBeNull();
  });

  /** Valor composto igual em todas as linhas também é constante. */
  it("compara valores aninhados por conteúdo", () => {
    const c = compactarLinhas([
      { id: 1, org: { cod: 7, nome: "A" } },
      { id: 2, org: { cod: 7, nome: "A" } },
      { id: 3, org: { cod: 7, nome: "A" } },
    ])!;
    expect(c.comum).toEqual({ org: { cod: 7, nome: "A" } });
  });

  it("preserva o valor exato do campo fatorado (o modelo ainda o lê)", () => {
    const c = compactarLinhas(pessoas)!;
    expect(c.comum.nome_empresa).toBe("NATCORP DO BRASIL");
  });
});

describe("notaCompactacao", () => {
  it("manda declarar o campo vazio em vez de negá-lo", () => {
    const nota = notaCompactacao(compactarLinhas(pessoas)!);
    expect(nota).toContain("_comum");
    expect(nota).toContain("_vazios");
    expect(nota).toMatch(/NÃO diga que o campo não existe/);
  });

  it("não fala de vazios quando não há nenhum", () => {
    const c = compactarLinhas([
      { a: 1, fixo: "x" },
      { a: 2, fixo: "x" },
      { a: 3, fixo: "x" },
    ])!;
    expect(notaCompactacao(c)).not.toContain("_vazios");
  });
});
