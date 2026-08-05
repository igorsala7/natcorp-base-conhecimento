import { describe, it, expect } from "vitest";
import { extractTable } from "./extract-table";

describe("extractTable (A2)", () => {
  it("CSV → colunas + linhas estruturadas (1ª linha = cabeçalho)", async () => {
    const csv = "nome,salario\nAna,1000\nBruno,2000\n";
    const t = await extractTable(Buffer.from(csv, "utf8"), "dados.csv", "text/csv");
    expect(t).not.toBeNull();
    expect(t!.colunas).toEqual(["nome", "salario"]);
    expect(t!.linhas).toEqual([["Ana", "1000"], ["Bruno", "2000"]]);
  });

  it("coluna sem nome vira 'colunaN'", async () => {
    const csv = "nome,,idade\nAna,x,30\n";
    const t = await extractTable(Buffer.from(csv, "utf8"), "d.csv", "text/csv");
    expect(t!.colunas).toEqual(["nome", "coluna2", "idade"]);
  });

  it("não-tabular (txt) → null", async () => {
    const t = await extractTable(Buffer.from("só um texto", "utf8"), "nota.txt", "text/plain");
    expect(t).toBeNull();
  });

  it("cabeçalho sem linhas de dados → null", async () => {
    const t = await extractTable(Buffer.from("a,b,c\n", "utf8"), "x.csv", "text/csv");
    expect(t).toBeNull();
  });
});
