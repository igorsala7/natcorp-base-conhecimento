import { describe, it, expect } from "vitest";
import { winAnsiSafe, specParaWinAnsi } from "./winansi";

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

/**
 * O caractere que derrubou um relatório real (18/08/2026).
 *
 * `gerar_relatorio` falhou com `WinAnsi cannot encode "−" (0x2212)` e o usuário
 * viu "o download não funciona" — o arquivo nunca chegou a existir.
 */
describe("o menos matemático não derruba nem inverte o número", () => {
  it("− (0x2212) vira hífen, e NÃO some", () => {
    // Descartar seria pior que falhar: "−1.234" viraria "1.234", um relatório
    // financeiro com o sinal trocado e nada indicando isso.
    expect(winAnsiSafe("Saldo: −1.234,56")).toBe("Saldo: -1.234,56");
    expect(winAnsiSafe("R$ 1.200 − R$ 900")).toBe("R$ 1.200 - R$ 900");
  });

  it("os outros matemáticos que o modelo escreve também sobrevivem", () => {
    expect(winAnsiSafe("≤ 10")).toBe("<= 10");
    expect(winAnsiSafe("≥ 5")).toBe(">= 5");
    expect(winAnsiSafe("≠ 0")).toBe("!= 0");
    // `±` é Latin-1: a fonte escreve, então ele fica como está.
    expect(winAnsiSafe("± 2")).toBe("± 2");
  });

  it("o saneamento alcança a estrutura inteira, não só os campos de texto solto", () => {
    // Foi por uma célula de tabela que o caractere passou: `winAnsiSafe` estava
    // em três pontos do pdf.ts e o desenho acontece em vinte.
    const spec = {
      titulo: "Auditoria − 2025",
      blocos: [{ tipo: "tabela", linhas: [["Diferença", "−1.234"]] }],
      n: 7,
      nulo: null,
    };
    expect(specParaWinAnsi(spec)).toEqual({
      titulo: "Auditoria - 2025",
      blocos: [{ tipo: "tabela", linhas: [["Diferença", "-1.234"]] }],
      n: 7,
      nulo: null,
    });
  });
});
