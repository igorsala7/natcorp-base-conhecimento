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

  it("o perfil comparado é o do TOKEN (p_perfil), como o portal manda", () => {
    // PG manda GESTOR e o agente nati_gestor exige "gestor" → casa.
    expect(perfilAtende("gestor", "GESTOR")).toBe(true);
    // PO manda MASTER: o agente de gestor NÃO se aplica pelo perfil (no portal PO
    // ele entra por outro caminho — o operador é elegível a todos os agentes).
    expect(perfilAtende("gestor", "MASTER")).toBe(false);
    // PC manda COLABORADOR.
    expect(perfilAtende("gestor", "COLABORADOR")).toBe(false);
  });
});

describe("acessoFerramenta (allowlist por portal × empresa × perfil)", () => {
  it("vazio = liberado para qualquer um", () => {
    expect(acessoFerramenta({}, { portal: "PC", perfil: "X", empresa: "1" })).toBe(true);
    expect(acessoFerramenta({ portais: [], empresas: [], perfis: [] }, {})).toBe(true);
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

  it("restringe por EMPRESA (AND), case-insensitive", () => {
    const regra = { empresas: ["1001", "2002"] };
    expect(acessoFerramenta(regra, { empresa: "1001" })).toBe(true);
    expect(acessoFerramenta(regra, { empresa: "9999" })).toBe(false); // empresa fora
    expect(acessoFerramenta(regra, {})).toBe(false); // empresa ausente com allowlist → nega
    expect(acessoFerramenta({ empresas: [" AB "] }, { empresa: "ab" })).toBe(true);
  });

  it("o Operador (PO) NÃO ignora a lista de EMPRESAS", () => {
    const regra = { empresas: ["1001"] };
    expect(acessoFerramenta(regra, { portal: "PO", empresa: "2002", operador: true })).toBe(false); // empresa trava mesmo PO
    expect(acessoFerramenta(regra, { portal: "PO", empresa: "1001", operador: true })).toBe(true);
  });

  it("as três dimensões combinam por AND", () => {
    const regra = { portais: ["PG"], empresas: ["1001"], perfis: ["MASTER"] };
    expect(acessoFerramenta(regra, { portal: "PG", empresa: "1001", perfil: "MASTER" })).toBe(true);
    expect(acessoFerramenta(regra, { portal: "PG", empresa: "2002", perfil: "MASTER" })).toBe(false); // empresa fora
  });
});
