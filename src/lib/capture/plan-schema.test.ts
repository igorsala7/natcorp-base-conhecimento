import { describe, it, expect } from "vitest";
import { zodSchema } from "ai";
import { capturePlanSchema, converterPlano, type CapturePlan } from "./plan-schema";

/** Mesmas travas de structured output das outras schemas do projeto. */
describe("capturePlanSchema (JSON Schema para o provedor)", () => {
  const json = zodSchema(capturePlanSchema).jsonSchema;

  it("não emite oneOf", () => {
    expect(JSON.stringify(json)).not.toContain('"oneOf"');
  });

  it("toda propriedade de todo objeto está em required (modo estrito)", () => {
    const walk = (node: unknown): void => {
      if (!node || typeof node !== "object") return;
      const o = node as Record<string, unknown>;
      if (o.type === "object" && o.properties && typeof o.properties === "object") {
        const req = Array.isArray(o.required) ? (o.required as string[]) : [];
        for (const p of Object.keys(o.properties as object)) expect(req).toContain(p);
      }
      for (const v of Object.values(o)) {
        if (Array.isArray(v)) v.forEach(walk);
        else walk(v);
      }
    };
    walk(json);
  });
});

describe("converterPlano", () => {
  const plan: CapturePlan = {
    prints: [
      { alvo: "PAGINA", destaque: null, legenda: "visão geral", acoes: null },
      {
        alvo: "e3",
        destaque: true,
        legenda: "o campo CPF",
        acoes: [
          { tipo: "clicar", ref: "e1", valor: null, ms: null },
          { tipo: "preencher", ref: "e2", valor: "123", ms: null },
          { tipo: "esperar", ref: null, valor: null, ms: 500 },
          { tipo: "clicar", ref: null, valor: null, ms: null }, // inválida (sem ref)
          { tipo: "preencher", ref: "e4", valor: null, ms: null }, // inválida (sem valor)
        ],
      },
    ],
  };

  it("no modo interativo mapeia e descarta ações inválidas", () => {
    const r = converterPlano(plan, "interactive");
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ alvo: "PAGINA", legenda: "visão geral" });
    expect(r[0]?.destaque).toBeUndefined();
    expect(r[1]).toMatchObject({ alvo: "e3", destaque: true, legenda: "o campo CPF" });
    // 5 ações vieram, só 3 são válidas.
    expect(r[1]?.acoes).toEqual([
      { tipo: "clicar", ref: "e1" },
      { tipo: "preencher", ref: "e2", valor: "123" },
      { tipo: "esperar", ms: 500 },
    ]);
  });

  it("no modo estático ignora as ações por completo", () => {
    const r = converterPlano(plan, "static");
    expect(r[1]?.acoes).toBeUndefined();
  });
});
