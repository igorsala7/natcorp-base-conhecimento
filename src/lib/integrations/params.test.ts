import { describe, it, expect } from "vitest";
import { identityFromTrack, buildModelSchema, resolveParams } from "./params";
import type { ToolParam } from "./tools";

describe("identityFromTrack", () => {
  it("mapeia p_* para os campos de identidade do motor", () => {
    const id = identityFromTrack({
      p_base: "ACME",
      p_usuario: "u1",
      p_empresa: "77",
      p_matricula: "12345",
      p_perfil: "gestor",
      p_portal: "rh",
    });
    expect(id).toEqual({
      usuario: "u1",
      cod_empresa: "77", // p_empresa → cod_empresa
      matricula: "12345",
      perfil: "gestor",
      portal: "rh",
    });
    // p_base NÃO é um campo de parâmetro (seleciona a base, não vira valor).
    expect((id as Record<string, unknown>).base).toBeUndefined();
  });

  it("deixa campos ausentes como undefined", () => {
    const id = identityFromTrack({ p_usuario: "só-esse" });
    expect(id.usuario).toBe("só-esse");
    expect(id.matricula).toBeUndefined();
  });
});

describe("buildModelSchema + resolveParams (fim a fim, sem HTTP)", () => {
  const params: ToolParam[] = [
    { nome: "cod_empresa", descricao: "", tipo: "string", origem: "identidade", obrigatorio: true, local: "query", campoIdentidade: "cod_empresa" },
    { nome: "competencia", descricao: "Mês", tipo: "date", origem: "modelo", obrigatorio: true, local: "query", mascara: "MM/yyyy" },
    { nome: "tipo", descricao: "", tipo: "enum", origem: "fixo", obrigatorio: false, local: "query", valorFixo: "proventos" },
  ];

  it("expõe ao modelo só o parâmetro origem=modelo", () => {
    expect(Object.keys(buildModelSchema(params).shape)).toEqual(["competencia"]);
  });

  it("resolve identidade + fixo + máscara na competência", () => {
    const identity = identityFromTrack({ p_empresa: "77" });
    const b = resolveParams(params, { competencia: "2026-08-01" }, identity);
    expect(b.query).toEqual({ cod_empresa: "77", competencia: "08/2026", tipo: "proventos" });
  });
});
