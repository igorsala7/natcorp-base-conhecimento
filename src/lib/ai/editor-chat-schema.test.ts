import { describe, it, expect } from "vitest";
import { zodSchema } from "ai";
import { editorChatSchema } from "./editor-chat-schema";

/** Mesmas guardas do structured output (OpenAI estrito), com o conversor real. */
describe("editor-chat-schema (JSON Schema para o provedor)", () => {
  const json = zodSchema(editorChatSchema).jsonSchema;

  it("não emite oneOf", () => {
    expect(JSON.stringify(json)).not.toContain('"oneOf"');
  });

  it("toda propriedade de todo objeto está em required (modo estrito)", () => {
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

  it("valida um turno com estrutura proposta", () => {
    const r = editorChatSchema.safeParse({
      mensagem: "Este artigo ficou amplo; sugiro separar em dois.",
      ops: null,
      ferramenta: null,
      perguntas: null,
      estrutura: [
        { tmp: "p1", tipo: "folder", titulo: "Configuração", pai: null },
        { tmp: "a1", tipo: "article", titulo: "Parâmetros gerais", pai: "p1" },
      ],
    });
    expect(r.success).toBe(true);
  });
});
