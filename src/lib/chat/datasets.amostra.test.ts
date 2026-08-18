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

  /**
   * O caso que a extrapolação não via, e que o trace de 30 dias mostrou em
   * produção: 293.789 bytes sob um teto de 60.000 (18/08/2026).
   *
   * Registro de RH tem ~200 campos OPCIONAIS. A primeira pessoa da lista pode
   * ter meia dúzia preenchida e as seguintes, todas. Medir só a linha 0 e
   * multiplicar por 50 não é uma aproximação com margem — é uma conta sobre a
   * linha errada, e ela erra para o lado que estoura.
   */
  it("lista ESPARSA respeita o teto (a linha 0 magra não decide pelas gordas)", () => {
    const linhas = [{ id: 1, nome: "Fulano" }, ...Array.from({ length: 95 }, () => linhaCom(200))];
    const n = linhasQueCabem(linhas);
    expect(JSON.stringify(linhas.slice(0, n)).length).toBeLessThanOrEqual(60_000);
  });

  it("lista curta e esparsa não sai inteira como se coubesse", () => {
    // 25 linhas cabem nas 50, então o corte por LINHAS nunca dispara: quem
    // precisa segurar é o de caracteres. Com a linha 0 magra, a extrapolação
    // concluía que as 25 cabiam — e como `truncado` é `total > cabem`, o
    // resultado saía marcado `_completo`: 148.841 bytes anunciados ao modelo
    // como a lista inteira, sem nota de amostra e sem apontar as ferramentas
    // de dados. Errar o teto aqui não encolhe a resposta, ela MENTE.
    const linhas = [{ id: 1, nome: "Fulano" }, ...Array.from({ length: 24 }, () => linhaCom(300))];
    const n = linhasQueCabem(linhas);
    expect(n).toBeLessThan(25);
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

  it("o trabalho é limitado pelo teto de linhas, não pelo tamanho da lista", () => {
    // Somar linha a linha não pode virar "serializar a lista toda para depois
    // cortar" — que é o trabalho que estoura a memória num resultado grande.
    // O laço para em `maxLinhas`, então 100 mil linhas custam o mesmo que 50.
    const enorme = Array.from({ length: 100_000 }, () => ({ a: 1 }));
    const t0 = Date.now();
    linhasQueCabem(enorme);
    expect(Date.now() - t0).toBeLessThan(50);
  });
});
