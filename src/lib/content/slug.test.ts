import { describe, it, expect } from "vitest";
import { slugify, validarSlugEspaco } from "./slug";

describe("slugify", () => {
  it("remove acento e normaliza", () => {
    expect(slugify("Administração de Pessoal")).toBe("administracao-de-pessoal");
  });
  it("colapsa separadores e apara as pontas", () => {
    expect(slugify("  --Produto   Alfa!!  ")).toBe("produto-alfa");
  });
});

describe("validarSlugEspaco", () => {
  const emUso = ["global", "produto-alfa", "antiga-do-beta"];

  it("normaliza a entrada antes de validar", () => {
    const r = validarSlugEspaco("Produto  Gama", emUso);
    expect(r).toEqual({ ok: true, slug: "produto-gama" });
  });

  it("recusa colisão com uma slug em uso", () => {
    const r = validarSlugEspaco("Produto Alfa", emUso);
    expect(r.ok).toBe(false);
  });

  // O ponto crítico: a slug aposentada continua reservada.
  it("recusa reaproveitar uma slug APOSENTADA (senão o link antigo levaria ao lugar errado)", () => {
    const r = validarSlugEspaco("antiga do beta", emUso);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("já pertence");
  });

  it("manter a própria slug não é colisão", () => {
    const r = validarSlugEspaco("produto-alfa", emUso, "produto-alfa");
    expect(r).toEqual({ ok: true, slug: "produto-alfa" });
  });

  it.each(["api", "admin", "docs", "_next", "robots.txt"])(
    "recusa a slug reservada %s",
    (reservada) => {
      expect(validarSlugEspaco(reservada, []).ok).toBe(false);
    },
  );

  it("recusa entrada vazia ou só símbolos", () => {
    expect(validarSlugEspaco("", []).ok).toBe(false);
    expect(validarSlugEspaco("!!!", []).ok).toBe(false);
  });

  it("recusa slug de um caractere", () => {
    expect(validarSlugEspaco("a", []).ok).toBe(false);
  });
});
