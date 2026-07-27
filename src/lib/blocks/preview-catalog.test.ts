import { describe, it, expect } from "vitest";
import { previewBlocks, temPreview } from "./preview-catalog";
import { BlockDocSchema } from "./schema";

// As chaves que a IA pode mandar em `preview` (documentadas no prompt do Estúdio).
const CHAVES = [
  "heading", "callout", "steps", "bullets", "checklist", "table", "code",
  "quote", "stats", "panel", "columns", "hero", "cardGrid", "accordion", "toggle", "paragraph",
];

describe("preview-catalog", () => {
  it("chave desconhecida → null; conhecidas → blocos", () => {
    expect(previewBlocks("inexistente")).toBeNull();
    expect(temPreview("xyz")).toBe(false);
    expect(temPreview("table")).toBe(true);
    expect(temPreview(null)).toBe(false);
  });

  it("todo exemplo do catálogo é um documento de blocos VÁLIDO (shape real)", () => {
    for (const chave of CHAVES) {
      const blocks = previewBlocks(chave);
      expect(blocks, `sem exemplo para "${chave}"`).not.toBeNull();
      const r = BlockDocSchema.safeParse({ version: 2, blocks: blocks! });
      expect(r.success, `bloco inválido em "${chave}": ${!r.success ? JSON.stringify(r.error.issues[0]) : ""}`).toBe(true);
    }
  });
});
