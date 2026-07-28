import { describe, it, expect } from "vitest";
import { pageContextFields, pageContextHint, pageContextNote } from "./page-context";

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
