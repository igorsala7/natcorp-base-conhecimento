import { describe, it, expect } from "vitest";
import { spansToHtml, applyMark, isMarkActive, textLength } from "./serialize-dom";
import type { RichText } from "@/lib/blocks/schema";

describe("spansToHtml", () => {
  it("escapa e aninha marcas", () => {
    const rt: RichText = [
      { text: "a<b> " },
      { text: "forte", marks: [{ type: "bold" }] },
      { text: " ", },
      { text: "link", marks: [{ type: "link", href: "https://x" }] },
    ];
    const html = spansToHtml(rt);
    expect(html).toContain("a&lt;b&gt; ");
    expect(html).toContain("<strong>forte</strong>");
    expect(html).toContain('<a data-mark="link" href="https://x">link</a>');
  });

  it("quebra de linha vira <br>", () => {
    expect(spansToHtml([{ text: "a\nb" }])).toBe("a<br>b");
  });
});

describe("applyMark", () => {
  const base: RichText = [{ text: "abcdef" }];

  it("aplica bold em uma faixa dividindo o span", () => {
    const out = applyMark(base, 2, 4, { type: "bold" }, false);
    expect(out).toEqual([
      { text: "ab" },
      { text: "cd", marks: [{ type: "bold" }] },
      { text: "ef" },
    ]);
  });

  it("remove bold da faixa (toggle off)", () => {
    const bolded: RichText = [{ text: "abcdef", marks: [{ type: "bold" }] }];
    const out = applyMark(bolded, 0, 6, { type: "bold" }, true);
    expect(out).toEqual([{ text: "abcdef" }]);
  });

  it("substitui a cor mantendo tipo único da marca", () => {
    const colored: RichText = [{ text: "abc", marks: [{ type: "color", color: "#f00" }] }];
    const out = applyMark(colored, 0, 3, { type: "color", color: "#00f" }, false);
    expect(out).toEqual([{ text: "abc", marks: [{ type: "color", color: "#00f" }] }]);
  });
});

describe("isMarkActive / textLength", () => {
  it("detecta marca ativa em toda a faixa", () => {
    const rt: RichText = [
      { text: "ab", marks: [{ type: "bold" }] },
      { text: "cd" },
    ];
    expect(isMarkActive(rt, 0, 2, "bold")).toBe(true);
    expect(isMarkActive(rt, 0, 4, "bold")).toBe(false);
  });

  it("textLength soma os spans incluindo quebras", () => {
    expect(textLength([{ text: "ab" }, { text: "\n" }, { text: "c" }])).toBe(4);
  });
});
