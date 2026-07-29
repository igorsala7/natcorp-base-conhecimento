import { describe, it, expect } from "vitest";
import { normalizeReport } from "./report-spec";

describe("normalizeReport", () => {
  it("aceita blocos de texto, tabela e gráfico e preserva a ordem", () => {
    const r = normalizeReport({
      titulo: "Relatório de Folha",
      subtitulo: "2026",
      blocos: [
        { tipo: "texto", texto: "Resumo do período." },
        { tipo: "tabela", tabela: { colunas: ["Mês", "Líquido"], linhas: [["Jan", "4100"], ["Fev", "4100"]] } },
        { tipo: "grafico", grafico: { tipo: "colunas", titulo: "Líquido", categorias: ["Jan", "Fev"], series: [{ nome: "L", valores: [4100, 4100] }] } },
      ],
    });
    expect(r).not.toBeNull();
    expect(r!.blocos.map((b) => b.tipo)).toEqual(["texto", "tabela", "grafico"]);
  });

  it("coage células da tabela a texto e corta ao nº de colunas", () => {
    const r = normalizeReport({
      titulo: "T",
      blocos: [{ tipo: "tabela", tabela: { colunas: ["A", "B"], linhas: [[1, 2, 3]] } }],
    });
    const tab = r!.blocos[0] as { tipo: "tabela"; colunas: string[]; linhas: string[][] };
    expect(tab.linhas[0]).toEqual(["1", "2"]); // 3ª célula cortada
  });

  it("ignora blocos inválidos e retorna null se não sobrar nenhum", () => {
    expect(
      normalizeReport({ titulo: "X", blocos: [{ tipo: "texto" }, { tipo: "tabela", tabela: { colunas: [] } }] }),
    ).toBeNull();
    expect(normalizeReport({ titulo: "X", blocos: [] })).toBeNull();
    expect(normalizeReport("nao objeto")).toBeNull();
  });

  it("usa 'Relatório' quando falta título", () => {
    const r = normalizeReport({ blocos: [{ tipo: "texto", texto: "oi" }] });
    expect(r!.titulo).toBe("Relatório");
  });
});
