import { describe, it, expect } from "vitest";
import { applyDateMask, parseCanonicalDate } from "./mask";

describe("applyDateMask", () => {
  it("formata YYYY-MM-DD nas máscaras mais comuns", () => {
    expect(applyDateMask("2026-08-01", "dd/MM/yyyy")).toBe("01/08/2026");
    expect(applyDateMask("2026-08-01", "yyyy-MM-dd")).toBe("2026-08-01");
    expect(applyDateMask("2026-08-31", "MM/yyyy")).toBe("08/2026");
  });

  it("aceita o estilo Oracle (dd/mm/rrrr) e ano de 2 dígitos", () => {
    expect(applyDateMask("2026-08-01", "dd/mm/rrrr")).toBe("01/08/2026");
    expect(applyDateMask("2026-08", "mm/rrrr")).toBe("08/2026");
    expect(applyDateMask("2026-08-01", "dd/mm/rr")).toBe("01/08/26");
  });

  it("trata dia/mês literais na máscara (01/MM/yyyy fixa o dia)", () => {
    expect(applyDateMask("2026-08-15", "01/MM/yyyy")).toBe("01/08/2026");
  });

  it("completa mês/dia ausentes e devolve valor cru se não parsear", () => {
    expect(applyDateMask("2026", "dd/MM/yyyy")).toBe("01/01/2026");
    expect(applyDateMask("agosto", "dd/MM/yyyy")).toBe("agosto");
  });

  it("parseCanonicalDate", () => {
    expect(parseCanonicalDate("2026-08-01")).toEqual({ y: "2026", m: "08", d: "01" });
    expect(parseCanonicalDate("2026-8")).toEqual({ y: "2026", m: "08", d: "01" });
    expect(parseCanonicalDate("x")).toBeNull();
  });
});
