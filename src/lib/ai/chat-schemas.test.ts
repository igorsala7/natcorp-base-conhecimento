import { describe, it, expect } from "vitest";
import { zodSchema } from "ai";
import { studioTurnSchema } from "./studio-schema";
import { editorChatSchema } from "./editor-chat-schema";

/** Mesmas guardas do layout-schema, com o conversor REAL do SDK. */
function guardas(nome: string, json: unknown) {
  describe(nome, () => {
    it("não emite oneOf (OpenAI strict rejeita)", () => {
      expect(JSON.stringify(json)).not.toContain('"oneOf"');
    });
    it("toda propriedade de todo objeto está em required", () => {
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
  });
}

guardas("studio-schema", zodSchema(studioTurnSchema).jsonSchema);
guardas("editor-chat-schema", zodSchema(editorChatSchema).jsonSchema);

describe("payloads típicos validam", () => {
  it("turno do estúdio", () => {
    const r = studioTurnSchema.safeParse({
      mensagem: "Criei a estrutura. Uma dúvida sobre o público…",
      perguntas: null,
      operacoes: [
        { op: "criar_no", tmpId: "p1", paiTmpId: null, aposTmpId: null, tipo: "folder", titulo: "Guia" },
        { op: "criar_no", tmpId: "a1", paiTmpId: "p1", aposTmpId: null, tipo: "article", titulo: "Visão geral" },
      ],
      gerarCorpo: ["a1"],
      diretivasCorpo: null,
    });
    expect(r.success).toBe(true);
  });

  it("turno do chat do editor (editar / ferramenta / responder)", () => {
    const editar = editorChatSchema.safeParse({
      mensagem: "Inseri a seção de pré-requisitos.",
      ops: [
        {
          op: "inserir_apos",
          blockId: "b1",
          blocks: [
            { kind: "heading", level: 2, text: "Pré-requisitos" },
            { kind: "bullets", items: ["Acesso de administrador"] },
          ],
        },
      ],
      ferramenta: null,
      perguntas: null,
    });
    expect(editar.success).toBe(true);
    const ferramenta = editorChatSchema.safeParse({
      mensagem: "Vou abrir o Melhorar layout para isso.",
      ops: null,
      ferramenta: "melhorar_layout",
      perguntas: null,
    });
    expect(ferramenta.success).toBe(true);
  });
});
