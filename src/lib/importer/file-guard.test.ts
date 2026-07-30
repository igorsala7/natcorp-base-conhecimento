import { describe, it, expect } from "vitest";
import { extDe, extensaoAceita, pareceBinario, assertArquivoSeguro, ACCEPT_ATTR } from "./file-guard";

const txt = (s: string) => new TextEncoder().encode(s);

describe("extDe / extensaoAceita", () => {
  it("extrai a extensão e aceita dev types + pptx", () => {
    expect(extDe("relatorio.PPTX")).toBe("pptx");
    expect(extDe("script.sql")).toBe("sql");
    expect(extDe("Dockerfile")).toBe("dockerfile");
    expect(extensaoAceita("a.js")).toBe(true);
    expect(extensaoAceita("a.pptx")).toBe(true);
    expect(extensaoAceita("a.exe")).toBe(false);
    expect(extensaoAceita("a.bin")).toBe(false);
  });
  it("ACCEPT_ATTR inclui pptx e sql", () => {
    expect(ACCEPT_ATTR).toContain(".pptx");
    expect(ACCEPT_ATTR).toContain(".sql");
  });
  it("ACCEPT_ATTR habilita CSV (extensão + MIMEs, p/ o seletor do macOS)", () => {
    expect(ACCEPT_ATTR).toContain(".csv");
    expect(ACCEPT_ATTR).toContain("text/csv");
    expect(ACCEPT_ATTR).toContain("application/vnd.ms-excel");
  });
});

describe("pareceBinario", () => {
  it("texto puro não é binário", () => {
    expect(pareceBinario(txt("SELECT * FROM users; -- comentário\nabc"))).toBe(false);
  });
  it("bytes NUL = binário", () => {
    expect(pareceBinario(new Uint8Array([65, 0, 66, 0, 67]))).toBe(true);
  });
});

describe("assertArquivoSeguro", () => {
  it("aceita .sql de texto", () => {
    expect(() => assertArquivoSeguro(txt("DELETE FROM x WHERE id=1;"), "d.sql")).not.toThrow();
  });
  it("rejeita extensão não permitida", () => {
    expect(() => assertArquivoSeguro(txt("MZ"), "virus.exe")).toThrow(/não permitido/i);
  });
  it("rejeita .ppt antigo pedindo pptx", () => {
    expect(() => assertArquivoSeguro(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]), "a.ppt")).toThrow(/pptx/i);
  });
  it("rejeita binário disfarçado de .txt", () => {
    expect(() => assertArquivoSeguro(new Uint8Array([0, 1, 2, 3, 0, 0]), "fake.txt")).toThrow(/binário/i);
  });
  it("rejeita docx sem assinatura zip", () => {
    expect(() => assertArquivoSeguro(txt("isto não é um zip"), "fake.docx")).toThrow(/Office/i);
  });
  it("aceita docx com assinatura PK", () => {
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]);
    expect(() => assertArquivoSeguro(zip, "real.docx")).not.toThrow();
  });
  it("rejeita pdf sem %PDF", () => {
    expect(() => assertArquivoSeguro(txt("nope"), "fake.pdf")).toThrow(/PDF/i);
  });
});
