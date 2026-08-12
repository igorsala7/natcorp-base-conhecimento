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
  mdtAgregar: (celulas: unknown[], calc: string) => number | null;
} {
  const src = readFileSync("public/widget.js", "utf8");
  const trecho = (nome: string): string => {
    const ini = src.indexOf(`  function ${nome}(`);
    if (ini < 0) throw new Error(`função ${nome}() não existe mais em public/widget.js`);
    const fim = src.indexOf("\n  }\n", ini);
    return src.slice(ini, fim + 4);
  };
  const fonte = ["kbMediana", "celulaNumero", "colunaNumerica", "csvDaTabela", "mdtAgregar"]
    .map(trecho)
    .join("\n");
  return new Function(`${fonte}\nreturn { celulaNumero, colunaNumerica, csvDaTabela, mdtAgregar };`)();
}

const { celulaNumero, colunaNumerica, csvDaTabela, mdtAgregar } = funcoesDoWidget();

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

/**
 * A IA condensa números em tabela ("R$ 2,3 Mi", "-R$ 614 K") — é bom de ler e
 * era o fim do gráfico: a coluna inteira virava texto e nada era somado.
 * Valores tirados de um relatório real (Relatório-2.csv, 12/08/2026).
 */
describe("celulaNumero — escala abreviada e sinais da IA", () => {
  it("entende mil, milhão, bilhão", () => {
    expect(celulaNumero("R$ 2,3 Mi")).toBe(2300000);
    expect(celulaNumero("R$ 1,7 Mi")).toBe(1700000);
    expect(celulaNumero("614 K")).toBe(614000);
    expect(celulaNumero("3 mil")).toBe(3000);
    expect(celulaNumero("1,2 Bi")).toBe(1200000000);
  });

  it("negativo com sinal comum e com o menos tipográfico", () => {
    expect(celulaNumero("-R$ 614 K")).toBe(-614000);
    expect(celulaNumero("\u2212614 K")).toBe(-614000);
  });

  it("travessão e vazio continuam sem valor", () => {
    // "—" é como a IA escreve "não se aplica" na linha de acumulado.
    expect(celulaNumero("—")).toBeNull();
    expect(celulaNumero("–")).toBeNull();
  });

  it("não inventa escala onde não há número", () => {
    expect(celulaNumero("Mi")).toBeNull();
    expect(celulaNumero("🟡 Atenção")).toBeNull();
    expect(celulaNumero("Crítico")).toBeNull();
  });

  it("a coluna condensada passa a ser numérica", () => {
    const linhas = [["Junho 2025", "R$ 2,3 Mi"], ["Julho 2025", "R$ 1,7 Mi"], ["Acumulado", "R$ 5,1 Mi"]];
    expect(colunaNumerica(linhas, 1)).toBe(true);
    expect(colunaNumerica(linhas, 0)).toBe(false);
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

describe("mdtAgregar — o cálculo do gráfico", () => {
  const valores = ["1.200", "R$ 300,50", "n/d", "500"];

  it("conta LINHAS, inclusive as sem número", () => {
    // É o que faz uma tabela só de texto (nome, cidade, idioma) virar gráfico.
    expect(mdtAgregar(valores, "contar")).toBe(4);
    expect(mdtAgregar(["São Paulo", "São Paulo"], "contar")).toBe(2);
  });

  it("conta DIFERENTES, ignorando vazio", () => {
    expect(mdtAgregar(["SP", "SP", "PR", ""], "distintos")).toBe(2);
  });

  it("soma, média, mediana, mínimo e máximo pulam o que não é número", () => {
    expect(mdtAgregar(valores, "soma")).toBe(2000.5);
    expect(mdtAgregar(valores, "media")).toBe(666.83);
    expect(mdtAgregar(valores, "mediana")).toBe(500);
    expect(mdtAgregar(valores, "min")).toBe(300.5);
    expect(mdtAgregar(valores, "max")).toBe(1200);
  });

  it("coluna sem número nenhum devolve null — e a dica manda contar", () => {
    // null (e não 0): zero seria um dado, e desenharia uma barra no chão como
    // se a resposta fosse "nenhum", quando a resposta é "não dá para somar".
    expect(mdtAgregar(["Superior Completo", "Médio"], "soma")).toBeNull();
    expect(mdtAgregar([], "media")).toBeNull();
  });
});
