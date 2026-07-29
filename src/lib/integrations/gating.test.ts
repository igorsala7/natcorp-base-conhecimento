import { describe, it, expect } from "vitest";
import { perfilAtende } from "./gating";

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
