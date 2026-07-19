import { describe, it, expect } from "vitest";
import { docToMarkdown } from "./export-markdown";

const doc = (content: unknown[]) => ({ type: "doc", content });

describe("docToMarkdown", () => {
  it("títulos viram #", () => {
    const md = docToMarkdown(doc([{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Seção" }] }]));
    expect(md.trim()).toBe("## Seção");
  });

  it("negrito, itálico, código e link inline", () => {
    const md = docToMarkdown(
      doc([
        {
          type: "paragraph",
          content: [
            { type: "text", text: "a ", marks: [] },
            { type: "text", text: "forte", marks: [{ type: "bold" }] },
            { type: "text", text: " ", marks: [] },
            { type: "text", text: "link", marks: [{ type: "link", attrs: { href: "https://x.com" } }] },
          ],
        },
      ]),
    );
    expect(md).toContain("**forte**");
    expect(md).toContain("[link](https://x.com)");
  });

  it("lista com marcadores", () => {
    const md = docToMarkdown(
      doc([
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "um" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "dois" }] }] },
          ],
        },
      ]),
    );
    expect(md).toContain("- um");
    expect(md).toContain("- dois");
  });

  it("bloco de código com linguagem", () => {
    const md = docToMarkdown(doc([{ type: "codeBlock", attrs: { language: "ts" }, content: [{ type: "text", text: "const x=1" }] }]));
    expect(md).toContain("```ts");
    expect(md).toContain("const x=1");
  });

  it("tabela em markdown", () => {
    const cell = (t: string) => ({ type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: t }] }] });
    const md = docToMarkdown(
      doc([
        {
          type: "table",
          content: [
            { type: "tableRow", content: [cell("A"), cell("B")] },
            { type: "tableRow", content: [cell("1"), cell("2")] },
          ],
        },
      ]),
    );
    expect(md).toContain("| A | B |");
    expect(md).toContain("| --- | --- |");
    expect(md).toContain("| 1 | 2 |");
  });
});
