import { describe, it, expect } from "vitest";
import { winAnsiSafe } from "./winansi";

describe("winAnsiSafe", () => {
  it("mantém ASCII puro intacto (caminho rápido)", () => {
    expect(winAnsiSafe("Resumo estrategico 2026")).toBe("Resumo estrategico 2026");
  });

  it("mantém acentos do português (Latin-1)", () => {
    const s = "Avaliação do colaborador Erlânio: informações e opção";
    expect(winAnsiSafe(s)).toBe(s);
  });

  it("mantém os extras do CP1252 (aspas curvas, travessão, reticências, euro, tm, bullet)", () => {
    const s = "“Relatório” — filtros… • valor €10 ™";
    expect(winAnsiSafe(s)).toBe(s);
  });

  it("REMOVE emoji (o que quebrava o pdf-lib: 0x1f31f, 0x1f4c8)", () => {
    expect(winAnsiSafe("Destaques \u{1F31F} do gestor")).toBe("Destaques  do gestor");
    expect(winAnsiSafe("Notas \u{1F4C8}")).toBe("Notas ");
    expect(winAnsiSafe("\u{1F3C6} Ranking")).toBe(" Ranking");
  });

  it("remove o seletor de variação que acompanha emoji (0xFE0F)", () => {
    expect(winAnsiSafe("Risco ⚠️ atencao")).toBe("Risco  atencao");
  });

  it("troca símbolos comuns por ASCII (setas, checks)", () => {
    expect(winAnsiSafe("subiu → muito")).toBe("subiu -> muito");
    expect(winAnsiSafe("ok ✓ feito")).toBe("ok OK feito");
    expect(winAnsiSafe("A ⇒ B")).toBe("A => B");
  });

  it("normaliza espaços especiais e remove largura-zero", () => {
    expect(winAnsiSafe("a b c")).toBe("a b c");
    expect(winAnsiSafe("zero​width")).toBe("zerowidth");
  });

  it("preserva tab/quebra de linha", () => {
    expect(winAnsiSafe("linha1\nlinha2\tfim")).toBe("linha1\nlinha2\tfim");
  });

  it("não quebra em string vazia", () => {
    expect(winAnsiSafe("")).toBe("");
  });
});
