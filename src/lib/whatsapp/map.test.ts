import { describe, it, expect } from "vitest";
import { getPath, mapIdentityResponse } from "./map";

describe("getPath", () => {
  it("lê campo simples e aninhado (por ponto)", () => {
    const obj = { empresa: "ACME", dados: { matricula: 12345 } };
    expect(getPath(obj, "empresa")).toBe("ACME");
    expect(getPath(obj, "dados.matricula")).toBe("12345"); // number → string
    expect(getPath(obj, "dados.inexistente")).toBeUndefined();
    expect(getPath(obj, undefined)).toBeUndefined();
  });
});

describe("mapIdentityResponse", () => {
  const map = {
    base_code: "empresa",
    p_matricula: "dados.matricula",
    p_usuario: "login",
    nome: "nome",
  };

  it("monta base_code + identidade a partir do mapa", () => {
    const r = mapIdentityResponse(
      { empresa: "ACME", login: "u1", nome: "Fábio", dados: { matricula: 999 } },
      map,
    );
    expect(r).not.toBeNull();
    expect(r!.baseCode).toBe("ACME");
    expect(r!.track).toEqual({
      p_base: "ACME",
      p_usuario: "u1",
      p_empresa: undefined,
      p_matricula: "999",
      p_perfil: undefined,
      p_portal: undefined,
    });
    expect(r!.nome).toBe("Fábio");
  });

  it("retorna null quando não identifica o cliente (sem base_code)", () => {
    expect(mapIdentityResponse({ login: "u1" }, map)).toBeNull();
  });
});
