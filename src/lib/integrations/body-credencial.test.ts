import { describe, it, expect } from "vitest";
import { envelopeBody } from "./executor";
import { resolveParams, buildModelSchema } from "./params";
import type { ToolParam } from "./tools";

describe("envelopeBody (envelope do corpo)", () => {
  it("object/null = objeto plano; array = [obj]; wrap:<chave> = {chave:[obj]}", () => {
    expect(envelopeBody(null, { a: 1 })).toEqual({ a: 1 });
    expect(envelopeBody("object", { a: 1 })).toEqual({ a: 1 });
    expect(envelopeBody("array", { a: 1 })).toEqual([{ a: 1 }]);
    expect(envelopeBody("wrap:saque", { a: 1 })).toEqual({ saque: [{ a: 1 }] });
  });
});

describe("resolveParams — origem 'credencial'", () => {
  const key: ToolParam = {
    nome: "key",
    descricao: "",
    tipo: "string",
    origem: "credencial",
    obrigatorio: true,
    local: "query",
    campoCredencial: "session_key",
  };

  it("injeta o campo do segredo da credencial na query", () => {
    const b = resolveParams([key], {}, {}, { session_key: "SK123" });
    expect(b.query.key).toBe("SK123");
  });

  it("obrigatório ausente no segredo lança (não chuta)", () => {
    expect(() => resolveParams([key], {}, {}, {})).toThrow();
  });

  it("não é exposto ao modelo (fora do inputSchema)", () => {
    const shape = buildModelSchema([key]).shape;
    expect(Object.keys(shape)).not.toContain("key");
  });
});
