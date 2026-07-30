import { describe, it, expect } from "vitest";
import { pageContextFields, pageContextHint, pageContextNote, mesmaPagina, pageChangeNote } from "./page-context";

describe("mudança de tela (#5)", () => {
  it("mesmaPagina compara por path; null nunca é igual", () => {
    expect(mesmaPagina({ path: "/a" }, { path: "/a", title: "X" })).toBe(true);
    expect(mesmaPagina({ path: "/a" }, { path: "/b" })).toBe(false);
    expect(mesmaPagina(null, { path: "/a" })).toBe(false);
    expect(mesmaPagina({ title: "" }, { title: "" })).toBe(false); // chave vazia
  });

  it("pageChangeNote só aparece quando a tela mudou", () => {
    expect(pageChangeNote({ path: "/a" }, { path: "/a" })).toBe("");
    expect(pageChangeNote(null, null)).toBe("");
    const nota = pageChangeNote({ path: "/ferias", title: "Férias" }, { path: "/ponto", title: "Ponto" });
    expect(nota).toContain("MUDANÇA DE TELA");
    expect(nota).toContain("Férias");
    expect(nota).toContain("Ponto");
  });
});

describe("page-context", () => {
  it("saneia e mantém só os campos presentes", () => {
    expect(pageContextFields({ href: " https://app/x ", path: "/x", title: "Emitir NF" })).toEqual({
      href: "https://app/x",
      path: "/x",
      title: "Emitir NF",
    });
    expect(pageContextFields({ title: "Só título" })).toEqual({ title: "Só título" });
  });

  it("descarta payload vazio ou não-objeto", () => {
    expect(pageContextFields(null)).toBeNull();
    expect(pageContextFields("x")).toBeNull();
    expect(pageContextFields({})).toBeNull();
    expect(pageContextFields({ href: "   " })).toBeNull();
    expect(pageContextFields({ title: 42 })).toBeNull();
  });

  it("aplica os tetos de tamanho", () => {
    const p = pageContextFields({ title: "a".repeat(1000), href: "b".repeat(1000) });
    expect(p?.title?.length).toBe(300);
    expect(p?.href?.length).toBe(500);
  });

  it("hint junta título e caminho", () => {
    expect(pageContextHint({ title: "Emitir NF", path: "/nf" })).toBe("Emitir NF — /nf");
    expect(pageContextHint(null)).toBe("");
  });

  it("nota rotula como DADO e cita a tela", () => {
    const nota = pageContextNote({ title: "Emitir NF", path: "/nf" });
    expect(nota).toContain("TELA ATUAL");
    expect(nota).toContain("DADO");
    expect(nota).toContain('"Emitir NF"');
    expect(nota).toContain("/nf");
    expect(pageContextNote(null)).toBe("");
    expect(pageContextNote({ href: "https://x" })).toBe(""); // sem título/caminho → sem nota
  });
});
