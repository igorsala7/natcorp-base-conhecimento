import { describe, it, expect } from "vitest";
import { formatarBytes, extensaoDoNome } from "./file-utils";

describe("formatarBytes", () => {
  it("escala B → KB → MB → GB; desconhecido some", () => {
    expect(formatarBytes(0)).toBe("");
    expect(formatarBytes(-5)).toBe("");
    expect(formatarBytes(12)).toBe("12 B");
    expect(formatarBytes(840_000)).toBe("820 KB");
    expect(formatarBytes(1_572_864)).toBe("1.5 MB");
    expect(formatarBytes(52_428_800)).toBe("50 MB");
    expect(formatarBytes(2_147_483_648)).toBe("2.0 GB");
  });
});

describe("extensaoDoNome", () => {
  it("extrai e normaliza; sem extensão vira ARQ", () => {
    expect(extensaoDoNome("Relatorio.PDF")).toBe("PDF");
    expect(extensaoDoNome("planilha.xlsx")).toBe("XLSX");
    expect(extensaoDoNome("sem-extensao")).toBe("ARQ");
    expect(extensaoDoNome("arquivo.")).toBe("ARQ");
  });
});
