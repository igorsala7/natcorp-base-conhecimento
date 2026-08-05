import { describe, it, expect } from "vitest";
import { GUARD_CATALOG, guardInfo } from "./guard-catalog";

describe("guard-catalog", () => {
  it("tem chaves únicas, rótulo e descrição não-vazios", () => {
    const chaves = GUARD_CATALOG.map((g) => g.key);
    expect(new Set(chaves).size).toBe(chaves.length);
    for (const g of GUARD_CATALOG) {
      expect(g.key.trim().length).toBeGreaterThan(0);
      expect(g.label.trim().length).toBeGreaterThan(0);
      expect(g.description.trim().length).toBeGreaterThan(0);
    }
  });

  it("guardInfo resolve por chave e ignora desconhecido/nulo", () => {
    expect(guardInfo("escopo_painel")?.label).toMatch(/painel/i);
    expect(guardInfo("saque_confirmation")?.key).toBe("saque_confirmation");
    expect(guardInfo("inexistente")).toBeNull();
    expect(guardInfo(null)).toBeNull();
    expect(guardInfo("  ")).toBeNull();
  });
});
