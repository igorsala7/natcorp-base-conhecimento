import { describe, it, expect } from "vitest";
import { notaDataAtual } from "./current-date";

describe("notaDataAtual", () => {
  it("formata a data de hoje no fuso de Brasília e deriva o ano passado", () => {
    const nota = notaDataAtual(new Date("2026-07-29T15:00:00Z")); // 12:00 BRT, mesmo dia
    expect(nota).toContain("29/07/2026");
    expect(nota).toContain('"este ano" = 2026');
    expect(nota).toContain('"ano passado" = 2025');
    expect(nota).toContain("fuso de Brasília");
    expect(nota).toMatch(/ISO/);
  });

  it("respeita o fuso na virada de ano (UTC já é 2026, mas em Brasília ainda é 2025)", () => {
    const nota = notaDataAtual(new Date("2026-01-01T02:00:00Z")); // 31/12/2025 23:00 BRT
    expect(nota).toContain("31/12/2025");
    expect(nota).toContain('"ano passado" = 2024');
  });
});
