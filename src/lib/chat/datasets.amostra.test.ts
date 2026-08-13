import { describe, it, expect } from "vitest";
import { linhasQueCabem } from "./datasets";

/**
 * O teto da amostra era só de LINHAS (50), e isso pressupõe linha estreita.
 * Uma consulta de cadastro funcional devolve ~200 campos por pessoa: 50 linhas
 * viraram 293 mil bytes e o turno morreu com
 * "prompt is too long: 207798 tokens > 200000 maximum" (13/08/2026).
 */
const linhaCom = (campos: number) =>
  Object.fromEntries(Array.from({ length: campos }, (_, i) => [`campo_${i}`, "valor de exemplo"]));

describe("linhasQueCabem", () => {
  it("linha estreita continua rendendo as 50 de sempre", () => {
    const linhas = Array.from({ length: 500 }, () => ({ id: 1, nome: "Fulano" }));
    expect(linhasQueCabem(linhas)).toBe(50);
  });

  it("linha LARGA rende menos — é o caso que estourava o contexto", () => {
    const linhas = Array.from({ length: 96 }, () => linhaCom(200));
    const n = linhasQueCabem(linhas);
    expect(n).toBeLessThan(50);
    expect(n).toBeGreaterThan(0);
    // O que importa: o que vai ao modelo cabe no orçamento.
    expect(JSON.stringify(linhas.slice(0, n)).length).toBeLessThanOrEqual(60_000);
  });

  it("nunca devolve zero: uma linha diz ao modelo que formato ele tem", () => {
    expect(linhasQueCabem([linhaCom(5000)])).toBe(1);
  });

  it("lista menor que o teto vai inteira", () => {
    expect(linhasQueCabem([{ a: 1 }, { a: 2 }])).toBe(2);
  });

  it("lista vazia é zero", () => {
    expect(linhasQueCabem([])).toBe(0);
  });

  it("mede pela primeira linha, sem serializar a lista toda", () => {
    // Serializar tudo para depois cortar é justamente o trabalho que estoura a
    // memória num resultado grande.
    const enorme = Array.from({ length: 100_000 }, () => ({ a: 1 }));
    const t0 = Date.now();
    linhasQueCabem(enorme);
    expect(Date.now() - t0).toBeLessThan(50);
  });
});
