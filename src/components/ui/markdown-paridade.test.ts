import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { Markdown } from "./markdown";

/**
 * O MESMO markdown, nos DOIS renderizadores.
 *
 * O projeto tem dois dialetos por um motivo que continua válido: o widget é
 * JavaScript puro servido como arquivo estático (Shadow DOM, sem dependência,
 * sem build), e o portal é React. Unificar exigiria empacotar o widget — deploy,
 * cache-busting e source map atrás de um parser de markdown.
 *
 * O que dá para garantir barato é que os dois NÃO ANDEM SEPARADOS: este arquivo
 * roda o mesmo corpus nos dois e compara a ESTRUTURA (as tags), ignorando classe
 * e estilo, que são de cada casca. Quando alguém acrescentar blockquote de um
 * lado só, aqui falha.
 *
 * O widget é lido do disco e as três funções do parser são avaliadas isoladas —
 * é o preço de ele não ser um módulo. Se alguém as renomear, o teste quebra
 * dizendo exatamente isso, que é melhor que uma divergência silenciosa.
 */

function parserDoWidget(): (md: string) => string {
  const src = readFileSync("public/widget.js", "utf8");
  const trecho = (nome: string): string => {
    const ini = src.indexOf(`  function ${nome}(`);
    if (ini < 0) throw new Error(`função ${nome}() não existe mais em public/widget.js`);
    // Fecha na primeira linha que volta à indentação de dois espaços com "}".
    const fim = src.indexOf("\n  }\n", ini);
    return src.slice(ini, fim + 4);
  };
  const fonte = ["esc", "inlineMd", "ehLinhaTabela", "ehSeparadorTabela", "celulasMd", "alinhamentosMd", "mdToHtml"]
    .map(trecho)
    .join("\n");
  return new Function(`${fonte}\nreturn mdToHtml;`)() as (md: string) => string;
}

/** Só as tags, na ordem — o que os dois têm de ter em comum. */
function estrutura(html: string): string {
  return (html.match(/<\/?[a-z]+/g) ?? []).join(" ");
}

const CASOS: { nome: string; md: string }[] = [
  { nome: "parágrafo simples", md: "Bom dia! Como posso ajudar?" },
  { nome: "título e parágrafo", md: "## Resumo\nForam 420 colaboradores ativos." },
  { nome: "lista não ordenada", md: "- Férias\n- Ponto\n- Holerite" },
  { nome: "lista ordenada", md: "1. Abrir o menu\n2. Clicar em Férias" },
  { nome: "inline", md: "Use **negrito**, *itálico*, `código` e [link](https://x.com)." },
  { nome: "bloco de código", md: "```\nselect 1\n```" },
  {
    nome: "tabela simples",
    md: "| Unidade | Total |\n|---|---|\n| São Paulo | 120 |\n| Curitiba | 38 |",
  },
  {
    nome: "tabela com alinhamento",
    md: "| Cargo | Qtd |\n|:---|---:|\n| Analista | 12 |",
  },
  {
    nome: "tabela com linha torta (célula faltando)",
    md: "| A | B | C |\n|---|---|---|\n| 1 | 2 |",
  },
  {
    nome: "tabela seguida de texto",
    md: "| A | B |\n|---|---|\n| 1 | 2 |\n\nIsso é tudo.",
  },
  { nome: "canos SEM separador não são tabela", md: "Ele disse | ela disse | fim" },
  // O relatório do ERP quebra a lista de verbas de propósito. É a ÚNICA tag que
  // os dois renderizadores interpretam em vez de escapar — e os dois têm de
  // interpretar, senão a marcação aparece literal num deles.
  { nome: "quebra <br> vira quebra nos dois", md: "• Salário: R$ 19.541,50<br>• Comissão: R$ 586,25" },
  { nome: "quebra <br/> dentro de célula de tabela", md: "| Verbas |\n|---|\n| • INSS<br>• IRRF |" },
  { nome: "toda outra tag continua ESCAPADA", md: "Isso <script>alert(1)</script> não é tag." },
];

describe("markdown — paridade entre o portal (React) e o widget", () => {
  const mdToHtml = parserDoWidget();

  for (const caso of CASOS) {
    it(`mesma estrutura: ${caso.nome}`, () => {
      const react = renderToStaticMarkup(React.createElement(Markdown, { content: caso.md }));
      // O React embrulha tudo num <div> de casca; o widget devolve os blocos
      // soltos. Tira a casca (primeira e última tag) antes de comparar.
      const toks = estrutura(react).split(" ");
      if (toks[0] === "<div") toks.shift();
      if (toks[toks.length - 1] === "</div") toks.pop();
      expect(toks.join(" ")).toBe(estrutura(mdToHtml(caso.md)));
    });
  }
});

describe("markdown — tabela", () => {
  const mdToHtml = parserDoWidget();
  const MD = "| Unidade | Total |\n|---|---:|\n| São Paulo | 120 |";

  it("o React monta thead/tbody e deixa a rolagem no bloco", () => {
    const html = renderToStaticMarkup(React.createElement(Markdown, { content: MD }));
    expect(html).toContain("<table");
    expect(html).toContain("<th");
    expect(html).toContain("São Paulo");
    expect(html).toMatch(/overflow-x-auto/);
  });

  it("o widget monta a mesma tabela, com a rolagem no bloco", () => {
    const html = mdToHtml(MD);
    expect(html).toContain("<table>");
    expect(html).toContain('<div class="mdt">');
    expect(html).toContain("São Paulo");
  });

  it("o alinhamento do separador vale nos dois", () => {
    expect(mdToHtml(MD)).toContain('text-align:right');
    expect(renderToStaticMarkup(React.createElement(Markdown, { content: MD }))).toContain("text-right");
  });

  // O conteúdo da célula pode vir de um documento que alguém anexou.
  it("célula com HTML é escapada no widget", () => {
    const html = mdToHtml("| a |\n|---|\n| <img src=x onerror=alert(1)> |");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("célula com HTML não vira elemento no React", () => {
    const html = renderToStaticMarkup(
      React.createElement(Markdown, { content: "| a |\n|---|\n| <script>x</script> |" }),
    );
    expect(html).not.toContain("<script>");
  });
});
