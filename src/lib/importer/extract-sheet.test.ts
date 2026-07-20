import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { extractSheet, cellToText, linhaComCabecalho } from "./extract-sheet";

/** Gera um .xlsx de verdade em memória — nada de fixture mockada. */
async function planilha(
  montar: (wb: ExcelJS.Workbook) => void,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  montar(wb);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe("cellToText", () => {
  it("resolve fórmula pelo RESULTADO, não pela expressão", () => {
    expect(cellToText({ formula: "A1*B1", result: 1200 })).toBe("1200");
  });
  it("achata texto rico do Excel", () => {
    expect(cellToText({ richText: [{ text: "Nota " }, { text: "fiscal" }] })).toBe("Nota fiscal");
  });
  it("hyperlink vira o texto visível", () => {
    expect(cellToText({ text: "Manual", hyperlink: "https://x" })).toBe("Manual");
  });
  it("vazio e nulo não viram 'null'/'undefined'", () => {
    expect(cellToText(null)).toBe("");
    expect(cellToText(undefined)).toBe("");
  });
});

describe("linhaComCabecalho", () => {
  it("repete o cabeçalho em cada valor — é o que torna a linha pesquisável", () => {
    expect(linhaComCabecalho(["Produto", "Preço"], ["Alfa", "1.200"])).toBe(
      "Produto: Alfa; Preço: 1.200",
    );
  });
  it("pula coluna vazia em vez de gerar 'Campo: '", () => {
    expect(linhaComCabecalho(["A", "B", "C"], ["1", "", "3"])).toBe("A: 1; C: 3");
  });
  it("sem cabeçalho, devolve só os valores", () => {
    expect(linhaComCabecalho([], ["x", "y"])).toBe("x; y");
  });
});

describe("extractSheet", () => {
  it("cabeçalho vira rótulo de cada linha e a aba vira título", async () => {
    const buf = await planilha((wb) => {
      const ws = wb.addWorksheet("Preços");
      ws.addRow(["Produto", "Preço", "Prazo"]);
      ws.addRow(["Alfa", 1200, "5 dias"]);
      ws.addRow(["Beta", 900, "3 dias"]);
    });
    const { source, blocks } = await extractSheet(buf);
    expect(source).toBe("sheet");
    expect(blocks[0]).toEqual({ text: "Preços", level: 1 });
    expect(blocks[1]?.text).toBe("Produto: Alfa; Preço: 1200; Prazo: 5 dias");
    expect(blocks[2]?.text).toBe("Produto: Beta; Preço: 900; Prazo: 3 dias");
  });

  it("aba vazia não gera título órfão", async () => {
    const buf = await planilha((wb) => {
      wb.addWorksheet("Vazia");
      const ws = wb.addWorksheet("Com dados");
      ws.addRow(["A", "B"]);
      ws.addRow(["1", "2"]);
    });
    const { blocks } = await extractSheet(buf);
    expect(blocks.map((b) => b.text)).not.toContain("Vazia");
    expect(blocks[0]?.text).toBe("Com dados");
  });

  it("planilha sem cabeçalho não inventa um: a 1ª linha vira conteúdo", async () => {
    const buf = await planilha((wb) => {
      const ws = wb.addWorksheet("Lista");
      ws.addRow(["item solto"]); // uma célula só → não é cabeçalho
      ws.addRow(["outro item"]);
    });
    const { blocks } = await extractSheet(buf);
    expect(blocks.map((b) => b.text)).toContain("item solto");
    expect(blocks.map((b) => b.text)).toContain("outro item");
  });

  it("várias abas viram várias seções", async () => {
    const buf = await planilha((wb) => {
      const a = wb.addWorksheet("Faturamento");
      a.addRow(["Campo", "Valor"]);
      a.addRow(["NF", "emitir"]);
      const b = wb.addWorksheet("Estoque");
      b.addRow(["Campo", "Valor"]);
      b.addRow(["Saldo", "42"]);
    });
    const { blocks } = await extractSheet(buf);
    const titulos = blocks.filter((b) => b.level === 1).map((b) => b.text);
    expect(titulos).toEqual(["Faturamento", "Estoque"]);
  });
});
