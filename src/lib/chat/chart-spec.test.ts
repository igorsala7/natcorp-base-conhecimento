import { describe, it, expect } from "vitest";
import { normalizeSpec, specToChartData, specToCsv, medianOf, linReg } from "./chart-spec";

describe("normalizeSpec", () => {
  it("alinha os valores ao número de categorias (preenche e corta)", () => {
    const s = normalizeSpec({
      tipo: "colunas",
      titulo: "Vendas",
      categorias: ["Jan", "Fev", "Mar"],
      series: [{ nome: "Bruto", valores: [10, 20] }], // faltando o 3º
    });
    expect(s).not.toBeNull();
    expect(s!.series[0]!.valores).toEqual([10, 20, 0]);
  });

  it("coage números em texto (pt-BR) e ignora lixo", () => {
    const s = normalizeSpec({
      tipo: "linha",
      titulo: "X",
      categorias: ["a", "b"],
      series: [{ nome: "S", valores: ["1.234,5" as unknown as number, "abc" as unknown as number] }],
    });
    expect(s!.series[0]!.valores).toEqual([1234.5, 0]);
  });

  it("cai para 'colunas' quando o tipo é inválido", () => {
    const s = normalizeSpec({ tipo: "3d", titulo: "", categorias: ["a"], series: [{ nome: "S", valores: [1] }] });
    expect(s!.tipo).toBe("colunas");
  });

  it("rejeita sem categorias, sem séries ou tudo zero", () => {
    expect(normalizeSpec({ tipo: "colunas", categorias: [], series: [] })).toBeNull();
    expect(normalizeSpec({ categorias: ["a"], series: [] })).toBeNull();
    expect(normalizeSpec({ categorias: ["a", "b"], series: [{ nome: "S", valores: [0, 0] }] })).toBeNull();
    expect(normalizeSpec("nao é objeto")).toBeNull();
  });
});

describe("specToChartData", () => {
  it("mapeia o tipo compacto para o chartType do editor/portal", () => {
    const d = specToChartData({ tipo: "rosca", titulo: "T", categorias: ["a", "b"], series: [{ nome: "S", valores: [3, 7] }] });
    expect(d.chartType).toBe("donut");
    expect(d.xKey).toBe("categoria");
    expect(d.rows).toEqual([{ categoria: "a", s0: 3 }, { categoria: "b", s0: 7 }]);
    expect(d.series).toEqual([{ key: "s0", label: "S" }]);
  });

  it("liga a legenda só com mais de uma série", () => {
    const uma = specToChartData({ tipo: "colunas", titulo: "", categorias: ["a"], series: [{ nome: "S", valores: [1] }] });
    const duas = specToChartData({ tipo: "colunas", titulo: "", categorias: ["a"], series: [{ nome: "A", valores: [1] }, { nome: "B", valores: [2] }] });
    expect(uma.legend).toBe(false);
    expect(duas.legend).toBe(true);
  });
});

describe("medianOf", () => {
  it("ímpar → do meio; par → média dos centrais; vazio/ruído → null", () => {
    expect(medianOf([3, 1, 2])).toBe(2);
    expect(medianOf([1, 2, 3, 4])).toBe(2.5);
    expect(medianOf([])).toBeNull();
    expect(medianOf([NaN, Infinity])).toBeNull();
  });
});

describe("linReg", () => {
  it("acha a reta de uma progressão perfeita (y = 10 + 5·x)", () => {
    const r = linReg([10, 15, 20, 25]);
    expect(r).not.toBeNull();
    expect(r!.a).toBeCloseTo(10);
    expect(r!.b).toBeCloseTo(5);
  });
  it("série constante → inclinação 0; menos de 2 pontos → null", () => {
    expect(linReg([7, 7, 7])!.b).toBeCloseTo(0);
    expect(linReg([1])).toBeNull();
  });
});

describe("mediana/tendência na spec", () => {
  it("normalizeSpec só inclui as flags quando true", () => {
    const base = { titulo: "T", categorias: ["a", "b"], series: [{ nome: "S", valores: [1, 2] }] };
    expect(normalizeSpec({ ...base, tipo: "colunas" })!.mediana).toBeUndefined();
    const s = normalizeSpec({ ...base, tipo: "colunas", mediana: true, tendencia: true });
    expect(s!.mediana).toBe(true);
    expect(s!.tendencia).toBe(true);
  });
  it("specToChartData espelha em showMedian/showTrend", () => {
    const d = specToChartData({ tipo: "linha", titulo: "T", categorias: ["a", "b"], series: [{ nome: "S", valores: [1, 2] }], mediana: true, tendencia: true });
    expect(d.showMedian).toBe(true);
    expect(d.showTrend).toBe(true);
  });
});

describe("specToCsv", () => {
  it("gera cabeçalho + linhas e escapa vírgula/aspas", () => {
    const csv = specToCsv({
      tipo: "colunas",
      titulo: "T",
      categorias: ["Jan", 'Fev, "23"'],
      series: [{ nome: "Bruto", valores: [10, 20] }],
    });
    const linhas = csv.split("\r\n");
    expect(linhas[0]).toBe("Categoria,Bruto");
    expect(linhas[1]).toBe("Jan,10");
    expect(linhas[2]).toBe('"Fev, ""23""",20');
  });
});
