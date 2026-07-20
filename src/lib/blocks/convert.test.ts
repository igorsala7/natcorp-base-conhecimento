import { describe, it, expect } from "vitest";
import { convertTipTapDoc, normalizeDoc, convertInline } from "./convert";
import { BlockDocSchema, type Block } from "./schema";
import { blocksToText } from "./serialize";
import { SAMPLE_PAGE } from "./sample";

const doc = (content: unknown[]) => ({ type: "doc", content });

/** Texto puro de um doc TipTap (equivalente ao antigo extractText). */
function tiptapText(node: unknown): string {
  const parts: string[] = [];
  const walk = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    const o = n as { text?: string; content?: unknown[] };
    if (typeof o.text === "string") parts.push(o.text);
    if (Array.isArray(o.content)) o.content.forEach(walk);
  };
  walk(node);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

describe("convertInline", () => {
  it("mapeia marks TipTap → marks de span", () => {
    const rt = convertInline([
      { type: "text", text: "a" },
      { type: "text", text: "b", marks: [{ type: "bold" }] },
      { type: "text", text: "c", marks: [{ type: "textStyle", attrs: { color: "#f00" } }] },
      { type: "text", text: "d", marks: [{ type: "link", attrs: { href: "https://x" } }] },
    ]);
    expect(rt).toEqual([
      { text: "a" },
      { text: "b", marks: [{ type: "bold" }] },
      { text: "c", marks: [{ type: "color", color: "#f00" }] },
      { text: "d", marks: [{ type: "link", href: "https://x" }] },
    ]);
  });

  it("hardBreak vira quebra de linha", () => {
    expect(convertInline([{ type: "text", text: "a" }, { type: "hardBreak" }, { type: "text", text: "b" }])).toEqual([
      { text: "a" },
      { text: "\n" },
      { text: "b" },
    ]);
  });
});

describe("convertTipTapDoc — totalidade", () => {
  const NODES: Record<string, unknown> = {
    paragraph: { type: "paragraph", content: [{ type: "text", text: "p" }] },
    heading: { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "h" }] },
    bulletList: { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "i" }] }] }] },
    orderedList: { type: "orderedList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "i" }] }] }] },
    blockquote: { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "q" }] }] },
    horizontalRule: { type: "horizontalRule" },
    codeBlock: { type: "codeBlock", attrs: { language: "ts" }, content: [{ type: "text", text: "x" }] },
    callout: { type: "callout", attrs: { variant: "warning" }, content: [{ type: "paragraph", content: [{ type: "text", text: "c" }] }] },
    steps: { type: "steps", content: [{ type: "stepItem", content: [{ type: "paragraph", content: [{ type: "text", text: "s" }] }] }] },
    accordion: { type: "accordion", content: [{ type: "accordionItem", attrs: { title: "T" }, content: [{ type: "paragraph", content: [{ type: "text", text: "a" }] }] }] },
    tabs: { type: "tabs", content: [{ type: "tabItem", attrs: { label: "L" }, content: [{ type: "paragraph", content: [{ type: "text", text: "t" }] }] }] },
    toggle: { type: "toggle", attrs: { title: "T" }, content: [{ type: "paragraph", content: [{ type: "text", text: "g" }] }] },
    columns: { type: "columns", content: [{ type: "column", content: [{ type: "paragraph", content: [{ type: "text", text: "1" }] }] }, { type: "column", content: [{ type: "paragraph", content: [{ type: "text", text: "2" }] }] }] },
    panel: { type: "panel", attrs: { bg: "blue" }, content: [{ type: "paragraph", content: [{ type: "text", text: "pn" }] }] },
    cardGrid: { type: "cardGrid", attrs: { cols: 2 }, content: [{ type: "card", attrs: { icon: "star", title: "C", href: "/x" }, content: [{ type: "paragraph", content: [{ type: "text", text: "cd" }] }] }] },
    figureImage: { type: "figureImage", attrs: { src: "u", alt: "a", caption: "c" } },
    video: { type: "video", attrs: { provider: "youtube", src: "https://youtu.be/aaaaaaaaaaa" } },
    linkCard: { type: "linkCard", attrs: { url: "https://x", title: "T", description: "D" } },
    htmlEmbed: { type: "htmlEmbed", attrs: { html: "<iframe src='x'></iframe>" } },
    snippet: { type: "snippet", attrs: { snippetKey: "k" } },
    hero: { type: "hero", attrs: { eyebrow: "e", title: "T", subtitle: "s", bg: "dark" } },
    spacer: { type: "spacer", attrs: { size: "lg" } },
    mermaid: { type: "mermaid", attrs: { code: "graph TD" } },
    buttonLink: { type: "buttonLink", attrs: { label: "L", href: "/x", variant: "secondary" } },
    table: { type: "table", content: [{ type: "tableRow", content: [{ type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "A" }] }] }] }] },
  };

  it("todo tipo TipTap converte sem lançar e valida no schema", () => {
    for (const [name, node] of Object.entries(NODES)) {
      const result = convertTipTapDoc(doc([node]));
      expect(BlockDocSchema.safeParse(result).success, name).toBe(true);
      expect(result.blocks.length, name).toBeGreaterThan(0);
    }
  });

  it("tipo desconhecido não descarta conteúdo (vira parágrafo)", () => {
    const r = convertTipTapDoc(doc([{ type: "algoNovo", content: [{ type: "text", text: "preservado" }] }]));
    expect(blocksToText(r.blocks)).toContain("preservado");
  });

  it("paridade de texto: blocksToText(convert(x)) contém o texto do TipTap", () => {
    for (const node of Object.values(NODES)) {
      const original = tiptapText(node);
      if (!original) continue;
      const converted = blocksToText(convertTipTapDoc(doc([node])).blocks);
      for (const word of original.split(/\s+/).filter(Boolean)) {
        expect(converted, `"${word}" em ${JSON.stringify(node).slice(0, 40)}`).toContain(word);
      }
    }
  });
});

describe("normalizeDoc — idempotência", () => {
  it("doc v2 passa inalterado", () => {
    expect(normalizeDoc(SAMPLE_PAGE)).toBe(SAMPLE_PAGE);
  });

  it("converter duas vezes é estável", () => {
    const once = convertTipTapDoc(doc([{ type: "paragraph", content: [{ type: "text", text: "x" }] }]));
    const twice = normalizeDoc(once);
    expect(twice).toBe(once);
  });

  it("null/undefined → doc vazio", () => {
    expect(normalizeDoc(null)).toEqual({ version: 2, blocks: [] });
    expect(normalizeDoc(undefined)).toEqual({ version: 2, blocks: [] });
  });
});

describe("SAMPLE_PAGE", () => {
  it("é um BlockDoc válido", () => {
    expect(BlockDocSchema.safeParse(SAMPLE_PAGE).success).toBe(true);
  });
  it("contém título, colunas, botão e embed de mapa", () => {
    const types = SAMPLE_PAGE.blocks.map((b: Block) => b.type);
    expect(types).toEqual(["heading", "container", "button", "embed"]);
  });
});
