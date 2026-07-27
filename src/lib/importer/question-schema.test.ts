import { describe, it, expect } from "vitest";
import { zodSchema } from "ai";
import { questionsSchema } from "./question-schema";

/** Mesmas guardas do layout-schema, com o conversor REAL do SDK. */
describe("question-schema (JSON Schema para o provedor)", () => {
  const json = zodSchema(questionsSchema).jsonSchema;

  it("não emite oneOf (structured output da OpenAI o rejeita)", () => {
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

  it("valida uma resposta típica (com e sem trecho/exemplo)", () => {
    const r = questionsSchema.safeParse({
      perguntas: [
        {
          id: "titulos",
          pergunta: "Os títulos das seções devem ter mais destaque ou serem sutis?",
          trecho: null,
          opcoes: [
            { rotulo: "Mais destaque", exemplo: null, preview: "heading", diretiva: "Use heading nível 2 nas seções." },
            { rotulo: "Sutis", exemplo: null, preview: null, diretiva: "Use heading nível 3 nas seções." },
          ],
        },
        {
          id: "status-tabela",
          pergunta: "A lista de status vira tabela ou lista?",
          trecho: "Status 1 Realizado, Status 2 Incompleto",
          opcoes: [
            {
              rotulo: "Tabela",
              exemplo: "| Status | Situação |\n| 1 | Realizado |",
              preview: "table",
              diretiva: "Converta a relação de status em uma tabela de duas colunas.",
            },
            {
              rotulo: "Lista",
              exemplo: "- Status 1 — Realizado",
              preview: "bullets",
              diretiva: "Converta a relação de status em lista com marcadores.",
            },
          ],
        },
      ],
    });
    expect(r.success).toBe(true);
  });
});
