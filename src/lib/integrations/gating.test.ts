import { describe, it, expect } from "vitest";
import { perfilAtende, acessoFerramenta } from "./gating";

describe("perfilAtende (trava de agente por perfil)", () => {
  it("sem exigência (null/vazio) vale para qualquer perfil, inclusive ausente", () => {
    expect(perfilAtende(null, "colaborador")).toBe(true);
    expect(perfilAtende("", "gestor")).toBe(true);
    expect(perfilAtende(null, undefined)).toBe(true);
  });

  it("exige gestor: só gestor passa", () => {
    expect(perfilAtende("gestor", "gestor")).toBe(true);
    expect(perfilAtende("gestor", "colaborador")).toBe(false);
    expect(perfilAtende("gestor", undefined)).toBe(false); // sem perfil resolvido → nega
    expect(perfilAtende("gestor", "")).toBe(false);
  });

  it("comparação é case-insensitive e aparada", () => {
    expect(perfilAtende(" Gestor ", "GESTOR")).toBe(true);
  });
});

describe("acessoFerramenta (allowlist por portal × perfil)", () => {
  it("vazio = liberado para qualquer um", () => {
    expect(acessoFerramenta({}, { portal: "PC", perfil: "X" })).toBe(true);
    expect(acessoFerramenta({ portais: [], perfis: [] }, {})).toBe(true);
  });

  it("restringe por portal e por perfil (AND), case-insensitive", () => {
    const regra = { portais: ["PG", "PC"], perfis: ["MASTER"] };
    expect(acessoFerramenta(regra, { portal: "pg", perfil: "master" })).toBe(true);
    expect(acessoFerramenta(regra, { portal: "PO", perfil: "MASTER" })).toBe(false); // portal fora
    expect(acessoFerramenta(regra, { portal: "PG", perfil: "OUTRO" })).toBe(false); // perfil fora
  });

  it("operador (PO) ignora a lista de PORTAIS, mas NÃO a de PERFIS", () => {
    const soPG = { portais: ["PG"], perfis: [] };
    expect(acessoFerramenta(soPG, { portal: "PO", perfil: "X", operador: true })).toBe(true);
    const soMaster = { portais: ["PG"], perfis: ["MASTER"] };
    expect(acessoFerramenta(soMaster, { portal: "PO", perfil: "MASTER", operador: true })).toBe(true);
    expect(acessoFerramenta(soMaster, { portal: "PO", perfil: "COMUM", operador: true })).toBe(false); // perfil trava
  });

  it("perfil ausente é negado quando há allowlist de perfil", () => {
    expect(acessoFerramenta({ perfis: ["MASTER"] }, { portal: "PG" })).toBe(false);
  });
});
