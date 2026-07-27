// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { htmlToBlocks, textToBlocks } from "./from-html";
import type { Block } from "./schema";

/** Afirma o tipo e devolve o bloco estreitado (evita `any` nos testes). */
function comoTipo<T extends Block["type"]>(b: Block | undefined, t: T): Extract<Block, { type: T }> {
  if (!b) throw new Error(`bloco ausente (esperava ${t})`);
  expect(b.type).toBe(t);
  return b as Extract<Block, { type: T }>;
}

describe("htmlToBlocks — texto e marcas", () => {
  it("mapeia negrito por CSS do Word (font-weight:700)", () => {
    const bs = htmlToBlocks(`<p class=MsoNormal><span style='font-weight:700'>Oi</span> mundo</p>`);
    expect(bs).toHaveLength(1);
    const p = comoTipo(bs[0], "paragraph");
    expect(p.text[0]).toEqual({ text: "Oi", marks: [{ type: "bold" }] });
    expect(p.text[1]?.text).toBe(" mundo");
    expect(p.text[1]?.marks).toBeUndefined();
  });

  it("mapeia negrito/itálico/tachado por TAG e junta spans iguais", () => {
    const p = comoTipo(htmlToBlocks(`<p><b>a</b><b>b</b> <i>i</i> <s>s</s></p>`)[0], "paragraph");
    expect(p.text[0]).toEqual({ text: "ab", marks: [{ type: "bold" }] });
    expect(p.text.find((s) => s.text === "i")?.marks).toEqual([{ type: "italic" }]);
    expect(p.text.find((s) => s.text === "s")?.marks).toEqual([{ type: "strike" }]);
  });

  it("preserva links (mas descarta href file:)", () => {
    const p = comoTipo(htmlToBlocks(`<p><a href="https://x.com">l</a> <a href="file:///c">z</a></p>`)[0], "paragraph");
    expect(p.text.find((s) => s.text === "l")?.marks).toEqual([{ type: "link", href: "https://x.com" }]);
    expect(p.text.find((s) => s.text === "z")?.marks).toBeUndefined();
  });
});

describe("htmlToBlocks — títulos", () => {
  it("mapeia h1..h6 com clamp em 3 níveis", () => {
    const bs = htmlToBlocks(`<h1>A</h1><h2>B</h2><h4>C</h4>`);
    expect(bs.map((b) => b.type)).toEqual(["heading", "heading", "heading"]);
    expect(comoTipo(bs[0], "heading").data.level).toBe(1);
    expect(comoTipo(bs[1], "heading").data.level).toBe(2);
    expect(comoTipo(bs[2], "heading").data.level).toBe(3);
  });

  it("reconhece título por estilo do Word (MsoTitle)", () => {
    const bs = htmlToBlocks(`<p class=MsoTitle>Manual</p>`);
    expect(comoTipo(bs[0], "heading").data.level).toBe(1);
  });
});

describe("htmlToBlocks — listas", () => {
  it("<ul>/<ol> viram bulletList/orderedList com listItem", () => {
    const ul = comoTipo(htmlToBlocks(`<ul><li><strong>um</strong></li><li>dois</li></ul>`)[0], "bulletList");
    expect(ul.children).toHaveLength(2);
    const li0 = comoTipo(ul.children[0], "listItem");
    expect(li0.text[0]).toEqual({ text: "um", marks: [{ type: "bold" }] });
    expect(htmlToBlocks(`<ol><li>a</li></ol>`)[0]?.type).toBe("orderedList");
  });

  it("aninha sub-listas dentro do item", () => {
    const ul = comoTipo(htmlToBlocks(`<ul><li>a<ul><li>a1</li></ul></li><li>b</li></ul>`)[0], "bulletList");
    const li0 = comoTipo(ul.children[0], "listItem");
    expect(li0.text[0]?.text).toBe("a");
    const sub = comoTipo((li0.children ?? [])[0], "bulletList");
    expect(comoTipo(sub.children[0], "listItem").text[0]?.text).toBe("a1");
  });

  it("agrupa pseudo-listas do Word (mso-list) — numerada", () => {
    const html =
      `<p class=MsoListParagraphCxSpFirst style='mso-list:l0 level1 lfo1'><span style='mso-list:Ignore'>1.<span>&nbsp;</span></span>Primeiro</p>` +
      `<p class=MsoListParagraphCxSpLast style='mso-list:l0 level1 lfo1'><span style='mso-list:Ignore'>2.<span>&nbsp;</span></span>Segundo</p>`;
    const bs = htmlToBlocks(html);
    expect(bs).toHaveLength(1);
    const ol = comoTipo(bs[0], "orderedList");
    expect(ol.children.map((c) => comoTipo(c, "listItem").text[0]?.text)).toEqual(["Primeiro", "Segundo"]);
  });

  it("pseudo-lista com marcador de bullet vira bulletList", () => {
    const html = `<p class=MsoListParagraph style='mso-list:l1 level1 lfo2'><span style='mso-list:Ignore'>·<span>&nbsp;</span></span>Item</p>`;
    expect(htmlToBlocks(html)[0]?.type).toBe("bulletList");
  });
});

describe("htmlToBlocks — tabela, citação, código", () => {
  it("<table> com <th> vira tabela com cabeçalho", () => {
    const t = comoTipo(
      htmlToBlocks(`<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>`)[0],
      "table",
    );
    expect(t.data.hasHeader).toBe(true);
    expect(t.data.rows).toHaveLength(2);
    expect(t.data.rows[0]?.[0]?.[0]?.text).toBe("A");
    expect(t.data.rows[1]?.[1]?.[0]?.text).toBe("2");
  });

  it("normaliza linhas com número de colunas desigual", () => {
    const t = comoTipo(htmlToBlocks(`<table><tr><td>1</td><td>2</td></tr><tr><td>3</td></tr></table>`)[0], "table");
    expect(t.data.rows[1]).toHaveLength(2);
    expect(t.data.rows[1]?.[1]).toEqual([]);
  });

  it("blockquote → quote e pre → code (preserva quebras)", () => {
    expect(htmlToBlocks(`<blockquote>cit</blockquote>`)[0]?.type).toBe("quote");
    const code = comoTipo(htmlToBlocks(`<pre>l1\nl2\n</pre>`)[0], "code");
    expect(code.data.code).toBe("l1\nl2");
  });
});

describe("htmlToBlocks — imagens e ruído", () => {
  it("imagem data: vira bloco; file:// é descartada", () => {
    const img = comoTipo(htmlToBlocks(`<p><img src="data:image/png;base64,AAAA" alt="x"></p>`)[0], "image");
    expect(img.data.src).toBe("data:image/png;base64,AAAA");
    expect(img.data.alt).toBe("x");
    expect(htmlToBlocks(`<p><img src="file:///C:/x.png"></p>`)).toHaveLength(0);
  });

  it("separa texto e imagem do mesmo parágrafo", () => {
    const bs = htmlToBlocks(`<p>antes<img src="https://x/y.png">depois</p>`);
    expect(bs.map((b) => b.type)).toEqual(["paragraph", "image"]);
  });

  it("remove <style>/<o:p> e parágrafos vazios (&nbsp;)", () => {
    expect(htmlToBlocks("")).toEqual([]);
    expect(htmlToBlocks(`<style>p{color:red}</style><p>Texto</p>`)).toHaveLength(1);
    expect(htmlToBlocks(`<p>&nbsp;</p><o:p></o:p>`)).toEqual([]);
  });
});

describe("textToBlocks", () => {
  it("quebra em parágrafos por linha, ignorando vazias", () => {
    const bs = textToBlocks("um\n\ndois\n");
    expect(bs.map((b) => comoTipo(b, "paragraph").text[0]?.text)).toEqual(["um", "dois"]);
  });
});
