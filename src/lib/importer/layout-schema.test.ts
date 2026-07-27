import { describe, it, expect } from "vitest";
import { zodSchema } from "ai";
import { blocksSchema, blocksSchemaCompacto } from "./layout-schema";

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
        { kind: "callout", variant: "info", titulo: null, text: "Atenção.", icon: "info" },
        { kind: "steps", items: [{ titulo: null, texto: "Primeiro" }, { titulo: null, texto: "Segundo" }] },
        { kind: "code", language: "ts", code: "const a = 1;", filename: null },
        { kind: "panel", bg: "purple", items: ["Um destaque."], icon: null },
        { kind: "columns", columns: [["esq"], ["dir"]], ratios: [1, 2], divider: null },
        { kind: "hero", eyebrow: null, title: "Seção", subtitle: null, icon: null },
        { kind: "cardGrid", cards: [{ title: "A", text: "a", icon: null }] },
        { kind: "toggle", title: "Detalhes", items: ["escondido"], icon: null },
        { kind: "table", rows: [["A", "B"], ["1", "2"]] },
        { kind: "quote", text: "Documentar é cuidar.", autor: null },
        { kind: "spacer", size: "md" },
        { kind: "accordion", items: [{ titulo: "Como instalar?", texto: "Baixe o pacote." }] },
        { kind: "divider" },
      ],
    };
    expect(blocksSchema.parse(doc).blocks).toHaveLength(15);
  });
});

describe("blocksSchemaCompacto (provedores com limite de gramática)", () => {
  const json = zodSchema(blocksSchemaCompacto).jsonSchema;

  it("não emite oneOf e é bem menor que o completo", () => {
    expect(JSON.stringify(json)).not.toContain('"oneOf"');
    // menos ramos de união → gramática menor (cabe no Anthropic/Google).
    const compacto = JSON.stringify(json).length;
    const completo = JSON.stringify(zodSchema(blocksSchema).jsonSchema).length;
    expect(compacto).toBeLessThan(completo);
  });

  it("aceita os 10 blocos-núcleo e REJEITA contêineres", () => {
    const ok = blocksSchemaCompacto.safeParse({
      blocks: [
        { kind: "heading", level: 2, text: "T" },
        { kind: "paragraph", text: "p" },
        { kind: "steps", items: [{ titulo: null, texto: "1" }] },
        { kind: "table", rows: [["a", "b"]] },
        { kind: "divider" },
      ],
    });
    expect(ok.success).toBe(true);
    // hero é contêiner → fora do compacto.
    const bad = blocksSchemaCompacto.safeParse({
      blocks: [{ kind: "hero", eyebrow: null, title: "x", subtitle: null, icon: null }],
    });
    expect(bad.success).toBe(false);
  });
});
