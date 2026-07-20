import { describe, it, expect } from "vitest";
import {
  blocksToText,
  blocksToMarkdown,
  blocksToHtml,
  blocksToPlainWithImageMarkers,
  firstImageOf,
} from "./serialize";
import { SAMPLE_PAGE } from "./sample";
import type { Block } from "./schema";

describe("blocksToText", () => {
  it("extrai texto puro do documento de exemplo", () => {
    const t = blocksToText(SAMPLE_PAGE.blocks);
    expect(t).toContain("Bem-vindo à Central de Ajuda");
    expect(t).toContain("primeiros passos");
    expect(t).toContain("Começar agora");
  });
});

describe("blocksToMarkdown", () => {
  it("título nível 1 e botão como link", () => {
    const md = blocksToMarkdown(SAMPLE_PAGE.blocks);
    expect(md).toContain("# Bem-vindo à Central de Ajuda");
    expect(md).toContain("[Começar agora](/docs/global/primeiros-passos)");
  });

  it("marks inline viram markdown", () => {
    const blocks: Block[] = [
      { id: "1", type: "paragraph", text: [{ text: "forte", marks: [{ type: "bold" }] }, { text: " normal" }] },
    ];
    expect(blocksToMarkdown(blocks)).toContain("**forte** normal");
  });
});

describe("blocksToHtml", () => {
  it("escapa HTML e gera tags semânticas", () => {
    const blocks: Block[] = [
      { id: "1", type: "heading", text: [{ text: "A & B" }], data: { level: 2 } },
      { id: "2", type: "paragraph", text: [{ text: "<script>", marks: [{ type: "code" }] }] },
    ];
    const html = blocksToHtml(blocks);
    expect(html).toContain("<h2>A &amp; B</h2>");
    expect(html).toContain("<code>&lt;script&gt;</code>");
  });
});

describe("blocksToPlainWithImageMarkers", () => {
  it("insere ⟦IMG:n⟧ e coleta as imagens", () => {
    const { text, images } = blocksToPlainWithImageMarkers(SAMPLE_PAGE.blocks);
    expect(text).toContain("⟦IMG:0⟧");
    expect(images).toHaveLength(1);
    expect(images[0]?.src).toBe("https://example.com/onboarding.png");
  });
});

describe("firstImageOf", () => {
  it("acha a primeira imagem, inclusive em colunas aninhadas", () => {
    expect(firstImageOf(SAMPLE_PAGE)).toBe("https://example.com/onboarding.png");
  });
  it("null quando não há imagem", () => {
    expect(firstImageOf({ version: 2, blocks: [{ id: "1", type: "paragraph", text: [] }] })).toBeNull();
  });
});
