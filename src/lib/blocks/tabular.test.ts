import { describe, it, expect } from "vitest";
import {
  ehNumero,
  detectarDelimitador,
  parseDelimited,
  rowsToChart,
  rowsToTable,
} from "./tabular";

describe("ehNumero", () => {
  it("aceita PT-BR, EN, moeda e %", () => {
    expect(ehNumero("1.234,56")).toBe(true);
    expect(ehNumero("1234.56")).toBe(true);
    expect(ehNumero("R$ 90")).toBe(true);
    expect(ehNumero("12%")).toBe(true);
    expect(ehNumero("Jan")).toBe(false);
    expect(ehNumero("")).toBe(false);
  });
});

describe("detectarDelimitador", () => {
  it("prefere TAB, depois ; depois ,", () => {
    expect(detectarDelimitador("a\tb\tc")).toBe("\t");
    expect(detectarDelimitador("a;b;c")).toBe(";");
    expect(detectarDelimitador("a,b,c")).toBe(",");
  });
});

describe("parseDelimited", () => {
  it("lê TSV colado de planilha", () => {
    expect(parseDelimited("Mês\tVendas\nJan\t120\nFev\t150")).toEqual([
      ["Mês", "Vendas"],
      ["Jan", "120"],
      ["Fev", "150"],
    ]);
  });
  it("respeita aspas com vírgula e aspas escapadas", () => {
    expect(parseDelimited('a,"b,c","d""e"')).toEqual([["a", "b,c", 'd"e']]);
  });
  it("descarta linhas vazias", () => {
    expect(parseDelimited("a,b\n\n\nc,d\n")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });
});

describe("rowsToChart", () => {
  it("detecta cabeçalho, X categórico e séries numéricas", () => {
    const r = rowsToChart([
      ["Mês", "Vendas", "Meta"],
      ["Jan", "120", "100"],
      ["Fev", "150", "130"],
    ])!;
    expect(r.xKey).toBe("mes");
    expect(r.series.map((s) => s.key)).toEqual(["vendas", "meta"]);
    expect(r.rows[0]).toEqual({ mes: "Jan", vendas: "120", meta: "100" });
  });
  it("gera cabeçalhos quando a 1ª linha já é dado numérico", () => {
    const r = rowsToChart([
      ["120", "90"],
      ["150", "130"],
    ])!;
    expect(r.columns.map((c) => c.label)).toEqual(["Coluna 1", "Coluna 2"]);
    expect(r.rows).toHaveLength(2);
  });
  it("chaves únicas para cabeçalhos repetidos", () => {
    const r = rowsToChart([
      ["Ano", "Valor", "Valor"],
      ["2024", "1", "2"],
    ])!;
    const keys = r.columns.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("rowsToTable", () => {
  it("monta RichText[][] e detecta cabeçalho", () => {
    const t = rowsToTable([
      ["Nome", "Idade"],
      ["Ana", "30"],
    ]);
    expect(t.hasHeader).toBe(true);
    expect(t.rows[0]![0]).toEqual([{ text: "Nome" }]);
    expect(t.rows[1]![1]).toEqual([{ text: "30" }]);
  });
  it("célula vazia vira RichText vazio", () => {
    const t = rowsToTable([["a", ""]]);
    expect(t.rows[0]![1]).toEqual([]);
  });
});
