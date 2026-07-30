import { describe, it, expect } from "vitest";
import { extractCsv, parseCsv, detectarDelim } from "./extract-csv";

describe("parseCsv (RFC 4180)", () => {
  it("linhas e campos simples", () => {
    expect(parseCsv("a,b,c\n1,2,3", ",")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("campo entre aspas com vírgula e aspas escapadas", () => {
    expect(parseCsv('nome,obs\n"Silva, João","disse ""oi"""', ",")).toEqual([
      ["nome", "obs"],
      ["Silva, João", 'disse "oi"'],
    ]);
  });

  it("quebra de linha DENTRO de aspas não separa a linha", () => {
    expect(parseCsv('a,b\n"linha1\nlinha2",x', ",")).toEqual([
      ["a", "b"],
      ["linha1\nlinha2", "x"],
    ]);
  });

  it("CRLF e linhas totalmente vazias", () => {
    expect(parseCsv("a,b\r\n1,2\r\n\r\n3,4", ",")).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("BOM inicial é removido", () => {
    expect(parseCsv("\uFEFFa,b\n1,2", ",")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("detectarDelim", () => {
  it("detecta ponto-e-vírgula (comum no Excel pt-BR)", () => {
    expect(detectarDelim("a;b;c\n1;2;3", "csv")).toBe(";");
  });
  it("detecta vírgula", () => {
    expect(detectarDelim("a,b,c", "csv")).toBe(",");
  });
  it("tsv força tab independentemente do conteúdo", () => {
    expect(detectarDelim("a,b\tc", "tsv")).toBe("\t");
  });
});

describe("extractCsv → blocos para RAG", () => {
  it("repete o cabeçalho em cada linha (como a planilha)", () => {
    const ex = extractCsv("Produto,Preço\nAlfa,1200\nBeta,900", "csv");
    expect(ex.source).toBe("sheet");
    expect(ex.blocks.map((b) => b.text)).toEqual([
      "Produto: Alfa; Preço: 1200",
      "Produto: Beta; Preço: 900",
    ]);
  });

  it("detecta ; e pula colunas vazias", () => {
    const ex = extractCsv("Nome;Cargo;Setor\nAna;;RH", "csv");
    expect(ex.blocks.map((b) => b.text)).toEqual(["Nome: Ana; Setor: RH"]);
  });

  it("sem cabeçalho (1 coluna) usa o valor cru", () => {
    const ex = extractCsv("laranja\nmaçã\nuva", "csv");
    expect(ex.blocks.map((b) => b.text)).toEqual(["laranja", "maçã", "uva"]);
  });

  it("arquivo vazio → nenhum bloco", () => {
    expect(extractCsv("", "csv").blocks).toEqual([]);
  });
});
