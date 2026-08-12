import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * As funções que transformam a TABELA DA RESPOSTA em relatório (salvar, CSV,
 * gráfico) vivem no `public/widget.js`, que não é módulo — então são lidas do
 * arquivo e avaliadas isoladas, como no teste de paridade do markdown.
 *
 * O que se testa aqui é o miolo que erra em silêncio: a leitura de número. Uma
 * coluna que o parser não entende não explode — vira um gráfico vazio, e a
 * pessoa conclui que "o gráfico não funciona".
 */
function funcoesDoWidget(): {
  celulaNumero: (v: unknown) => number | null;
  colunaNumerica: (linhas: string[][], j: number) => boolean;
  csvDaTabela: (d: { colunas: string[]; linhas: string[][] }) => string;
} {
  const src = readFileSync("public/widget.js", "utf8");
  const trecho = (nome: string): string => {
    const ini = src.indexOf(`  function ${nome}(`);
    if (ini < 0) throw new Error(`função ${nome}() não existe mais em public/widget.js`);
    const fim = src.indexOf("\n  }\n", ini);
    return src.slice(ini, fim + 4);
  };
  const fonte = ["celulaNumero", "colunaNumerica", "csvDaTabela"].map(trecho).join("\n");
  return new Function(`${fonte}\nreturn { celulaNumero, colunaNumerica, csvDaTabela };`)();
}

const { celulaNumero, colunaNumerica, csvDaTabela } = funcoesDoWidget();

describe("celulaNumero — o número como a pessoa LÊ", () => {
  it("entende o formato pt-BR", () => {
    expect(celulaNumero("1.234,56")).toBe(1234.56);
    expect(celulaNumero("1.200")).toBe(1200); // ponto é milhar, não decimal
    expect(celulaNumero("42")).toBe(42);
    expect(celulaNumero("0,5")).toBe(0.5);
  });

  it("tira o que é enfeite de relatório", () => {
    expect(celulaNumero("R$ 1.200,00")).toBe(1200);
    expect(celulaNumero("45%")).toBe(45);
    expect(celulaNumero(" 88 ")).toBe(88);
  });

  it("negativo contábil entre parênteses", () => {
    expect(celulaNumero("(320)")).toBe(-320);
    expect(celulaNumero("(1.250,50)")).toBe(-1250.5);
  });

  it("o que não é número devolve null — e não NaN", () => {
    // NaN percorreria o gráfico inteiro sem ninguém perceber a origem.
    expect(celulaNumero("São Paulo")).toBeNull();
    expect(celulaNumero("")).toBeNull();
    expect(celulaNumero("—")).toBeNull();
    expect(celulaNumero(null)).toBeNull();
  });
});

describe("colunaNumerica — que colunas viram eixo de valor", () => {
  const linhas = [
    ["São Paulo", "120", "R$ 1.000,00"],
    ["Curitiba", "38", "R$ 900,00"],
    ["Recife", "n/d", "R$ 1.100,00"],
  ];

  it("coluna de texto não é candidata", () => {
    expect(colunaNumerica(linhas, 0)).toBe(false);
  });

  it("coluna de número é candidata mesmo com uma falha", () => {
    expect(colunaNumerica(linhas, 1)).toBe(true);
  });

  it("moeda conta como número", () => {
    expect(colunaNumerica(linhas, 2)).toBe(true);
  });

  it("coluna vazia não é candidata", () => {
    expect(colunaNumerica([["a", ""], ["b", ""]], 1)).toBe(false);
  });
});

describe("csvDaTabela", () => {
  const dados = { colunas: ["Unidade", "Total"], linhas: [["São Paulo", "120"], ['Diz "oi"; e vai', "1"]] };

  it("abre no Excel pt-BR sem assistente de importação", () => {
    expect(csvDaTabela(dados).startsWith("sep=;\r\n")).toBe(true);
  });

  it("escapa aspas e o próprio separador", () => {
    const csv = csvDaTabela(dados);
    expect(csv).toContain('"Diz ""oi""; e vai"');
  });

  it("mantém a ordem das colunas do cabeçalho", () => {
    expect(csvDaTabela(dados).split("\r\n")[1]).toBe("Unidade;Total");
  });
});
