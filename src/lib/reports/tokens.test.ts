import { describe, it, expect } from "vitest";
import { tokenizarRuns } from "./tokens";
import { parseMarkdown } from "./markdown";

const t = (runs: { text: string; bold?: boolean }[]) =>
  tokenizarRuns(runs).map((x) => (x.colado ? "+" : "") + x.texto);

describe("espaço na fronteira do run", () => {
  it("O CASO REAL: pontuação depois de negrito não ganha espaço", () => {
    // Visto no PDF de amostra: "1.284 colaboradores , 3,1%". O "+" marca colado.
    expect(t([{ text: "1.284 colaboradores", bold: true }, { text: ", 3,1% acima" }]))
      .toEqual(["1.284", "colaboradores", "+,", "3,1%", "acima"]);
  });

  it("vale para a pontuação toda, não só a vírgula", () => {
    for (const p of [".", ":", ";", "?", "!", ")"]) {
      expect(t([{ text: "total", bold: true }, { text: p }])).toEqual(["total", "+" + p]);
    }
  });

  it("negrito no MEIO da palavra também cola dos dois lados", () => {
    // "R$**2,3**mi" — raro, mas se colar de um lado e não do outro fica pior
    // do que não colar de nenhum.
    expect(t([{ text: "R$" }, { text: "2,3", bold: true }, { text: "mi" }]))
      .toEqual(["R$", "+2,3", "+mi"]);
  });

  it("quando HÁ espaço na fronteira, não cola", () => {
    expect(t([{ text: "o total", bold: true }, { text: " subiu" }])).toEqual(["o", "total", "subiu"]);
    expect(t([{ text: "o total ", bold: true }, { text: "subiu" }])).toEqual(["o", "total", "subiu"]);
  });

  it("run só de espaço não cola o próximo indevidamente", () => {
    expect(t([{ text: "fim", bold: true }, { text: "   " }, { text: "novo" }])).toEqual(["fim", "novo"]);
  });

  it("entradas degeneradas não quebram", () => {
    expect(tokenizarRuns([])).toEqual([]);
    expect(tokenizarRuns([{ text: "" }])).toEqual([]);
    expect(tokenizarRuns([{ text: "   " }])).toEqual([]);
    expect(tokenizarRuns(undefined as never)).toEqual([]);
  });

  it("preserva o negrito de cada token", () => {
    expect(tokenizarRuns([{ text: "a", bold: true }, { text: "b" }]).map((x) => x.negrito)).toEqual([true, false]);
  });
});

describe("ponta a ponta com o parser de markdown", () => {
  it("o markdown real produz a colagem certa", () => {
    // Fecha o ciclo: o defeito nasceu de um markdown escrito por IA, então o
    // teste parte do markdown e não de runs montados à mão.
    const bloco = parseMarkdown("O quadro fechou com **1.284 colaboradores**, 3,1% acima.")[0]!;
    expect(bloco.kind).toBe("paragraph");
    const palavras = tokenizarRuns("runs" in bloco ? bloco.runs : []);
    const virgula = palavras.find((p) => p.texto.startsWith(","));
    expect(virgula?.colado).toBe(true);
  });
});
