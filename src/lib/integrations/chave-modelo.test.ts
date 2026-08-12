import { describe, it, expect } from "vitest";
import { buildModelSchema, chaveDoModelo, resolveParams } from "./params";
import type { ToolParam } from "./tools";

/**
 * 12/08/2026: as ferramentas do Microsoft Graph entraram no catálogo e a
 * Anthropic recusou o turno INTEIRO — "Property keys should match pattern
 * '^[a-zA-Z0-9_.-]{1,64}$'" — por causa do `$top` do OData. Não é um parâmetro
 * malcadastrado: é o nome que a API usa.
 */
const PADRAO = /^[a-zA-Z0-9_.-]{1,64}$/;

describe("chaveDoModelo", () => {
  it("troca o que o schema não aceita, preservando o resto", () => {
    expect(chaveDoModelo("$top")).toBe("top");
    expect(chaveDoModelo("$search")).toBe("search");
    expect(chaveDoModelo("p_matricula")).toBe("p_matricula");
    expect(chaveDoModelo("filtro.campo-1")).toBe("filtro.campo-1");
  });

  it("nome de puro símbolo ainda vira chave válida", () => {
    expect(PADRAO.test(chaveDoModelo("$$$"))).toBe(true);
    expect(PADRAO.test(chaveDoModelo(""))).toBe(true);
  });

  it("corta em 64 caracteres", () => {
    expect(chaveDoModelo("a".repeat(200))).toHaveLength(64);
  });
});

const params: ToolParam[] = [
  { nome: "$top", origem: "modelo", local: "query", tipo: "number", obrigatorio: false },
  { nome: "$search", origem: "modelo", local: "query", tipo: "string", obrigatorio: false },
] as unknown as ToolParam[];

describe("schema × requisição", () => {
  it("o modelo vê a chave saneada", () => {
    for (const k of Object.keys(buildModelSchema(params).shape)) expect(PADRAO.test(k)).toBe(true);
    expect(Object.keys(buildModelSchema(params).shape).sort()).toEqual(["search", "top"]);
  });

  it("a API recebe o nome ORIGINAL — `top` não é `$top` para o Graph", () => {
    const b = resolveParams(params, { top: 10, search: "contrato" }, {});
    expect(b.query).toEqual({ $top: "10", $search: "contrato" });
  });
});
