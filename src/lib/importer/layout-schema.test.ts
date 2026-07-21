import { describe, it, expect } from "vitest";
import { zodSchema } from "ai";
import { blocksSchema } from "./layout-schema";

/**
 * Guardas das três minas do structured output (ver layout-schema.ts).
 * Usa o MESMO conversor do SDK (`zodSchema`), não uma aproximação.
 */
describe("layout-schema (JSON Schema para o provedor)", () => {
  const json = zodSchema(blocksSchema).jsonSchema;

  it("não emite oneOf — o structured output da OpenAI o rejeita", () => {
    // z.discriminatedUnion vira oneOf no zod 4; z.union vira anyOf.
    const texto = JSON.stringify(json);
    expect(texto).not.toContain('"oneOf"');
    expect(texto).toContain('"anyOf"');
  });

  it("toda propriedade de todo objeto está em required (modo estrito)", () => {
    // A regra do `.nullable()` (nunca `.optional()`): campo fora de
    // `required` derruba a chamada inteira com invalid_json_schema.
    const walk = (node: unknown): void => {
      if (!node || typeof node !== "object") return;
      const o = node as Record<string, unknown>;
      if (o.type === "object" && o.properties && typeof o.properties === "object") {
        const req = Array.isArray(o.required) ? (o.required as string[]) : [];
        for (const p of Object.keys(o.properties as object)) {
          expect(req, `propriedade "${p}" fora de required`).toContain(p);
        }
      }
      for (const v of Object.values(o)) {
        if (Array.isArray(v)) v.forEach(walk);
        else walk(v);
      }
    };
    walk(json);
  });

  it("valida um documento típico devolvido pela IA", () => {
    const doc = {
      blocks: [
        { kind: "heading", level: 2, text: "Título" },
        { kind: "paragraph", text: "Um parágrafo." },
        { kind: "callout", variant: "info", text: "Atenção.", icon: "info" },
        { kind: "steps", items: ["Primeiro", "Segundo"] },
        { kind: "code", language: "ts", code: "const a = 1;" },
        { kind: "panel", bg: "purple", items: ["Um destaque."], icon: null },
        { kind: "columns", columns: [["esq"], ["dir"]], ratios: [1, 2], divider: null },
        { kind: "hero", eyebrow: null, title: "Seção", subtitle: null, icon: null },
        { kind: "cardGrid", cards: [{ title: "A", text: "a", icon: null }] },
        { kind: "toggle", title: "Detalhes", items: ["escondido"], icon: null },
        { kind: "table", rows: [["A", "B"], ["1", "2"]] },
        { kind: "divider" },
      ],
    };
    expect(blocksSchema.parse(doc).blocks).toHaveLength(12);
  });
});
