import { describe, it, expect } from "vitest";
import { ajustarParaFuturo } from "./data-futura";

/** Data da conversa que motivou isto: 13/08/2026. */
const HOJE = new Date(2026, 7, 13);

describe("ajustarParaFuturo — o ano que a pessoa não disse", () => {
  it("mês ainda por vir neste ano fica no ano corrente", () => {
    // "quero sair 01/10", hoje 13/08/2026 → outubro DESTE ano.
    expect(ajustarParaFuturo("2026-10-01", HOJE)).toBe("2026-10-01");
  });

  it("mês já passado neste ano vai para o ano seguinte", () => {
    // "01/04" em agosto só pode ser abril do ano que vem.
    expect(ajustarParaFuturo("2026-04-01", HOJE)).toBe("2027-04-01");
  });

  it("corrige o ano que o modelo errou para trás", () => {
    // O caso real: "01/11" virou 2025-11-01 e o ERP respondeu com a data mínima
    // de 2025, confundindo a conversa inteira.
    expect(ajustarParaFuturo("2025-11-01", HOJE)).toBe("2026-11-01");
    expect(ajustarParaFuturo("2024-12-01", HOJE)).toBe("2026-12-01");
  });

  it("hoje continua valendo — férias podem começar hoje", () => {
    expect(ajustarParaFuturo("2026-08-13", HOJE)).toBe("2026-08-13");
  });

  it("ontem vira o ano que vem", () => {
    expect(ajustarParaFuturo("2026-08-12", HOJE)).toBe("2027-08-12");
  });

  it("preserva o formato pt-BR", () => {
    expect(ajustarParaFuturo("01/04/2026", HOJE)).toBe("01/04/2027");
    expect(ajustarParaFuturo("01/10/2026", HOJE)).toBe("01/10/2026");
  });

  it("29 de fevereiro pula para o próximo ano bissexto", () => {
    // Sem isto, `new Date(2027, 1, 29)` viraria 01/03 em silêncio — a pessoa
    // sairia de férias num dia que nunca escolheu.
    expect(ajustarParaFuturo("2024-02-29", HOJE)).toBe("2028-02-29");
  });

  it("o que não parseia volta intocado", () => {
    // Melhor a API recusar um valor estranho do que este módulo inventar data.
    expect(ajustarParaFuturo("", HOJE)).toBe("");
    expect(ajustarParaFuturo("outubro", HOJE)).toBe("outubro");
    expect(ajustarParaFuturo("2026-13-45", HOJE)).toBe("2026-13-45");
  });

  it("vira o ano na virada do ano", () => {
    const reveillon = new Date(2026, 11, 31);
    expect(ajustarParaFuturo("2026-01-05", reveillon)).toBe("2027-01-05");
    expect(ajustarParaFuturo("2026-12-31", reveillon)).toBe("2026-12-31");
  });
});
