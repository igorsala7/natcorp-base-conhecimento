import { describe, it, expect } from "vitest";
import { bonusDeUso, aplicarAprendizado, MAX_BONUS, MIN_AMOSTRAS } from "./aprendizado";

describe("bonusDeUso", () => {
  it("a mais usada em perguntas parecidas recebe o teto", () => {
    const b = bonusDeUso([{ tool_key: "a", peso: 8, amostras: 10 }, { tool_key: "b", peso: 4, amostras: 5 }]);
    expect(b.get("a")).toBeCloseTo(MAX_BONUS);
    expect(b.get("b")).toBeCloseTo(MAX_BONUS / 2);
  });

  it("amostra pequena não vira regra", () => {
    // Um acerto isolado não pode passar a decidir o ranqueamento.
    expect(bonusDeUso([{ tool_key: "a", peso: 9, amostras: MIN_AMOSTRAS - 1 }]).size).toBe(0);
  });

  it("normaliza pelo turno, não pelo volume histórico", () => {
    // Senão uma base antiga daria bônus maior que uma nova só por ter mais registro.
    const nova = bonusDeUso([{ tool_key: "a", peso: 3, amostras: 3 }]);
    const antiga = bonusDeUso([{ tool_key: "a", peso: 300, amostras: 300 }]);
    expect(nova.get("a")).toBeCloseTo(antiga.get("a")!);
  });

  it("sem histórico não há bônus", () => {
    expect(bonusDeUso([]).size).toBe(0);
  });
});

describe("aplicarAprendizado", () => {
  const sim = new Map([["a", 0.60], ["b", 0.64]]);

  it("desempata sem mandar: o bônus soma, não substitui", () => {
    const r = aplicarAprendizado(sim, new Map([["a", MAX_BONUS]]));
    expect(r.get("a")).toBeCloseTo(0.66);
    expect(r.get("a")!).toBeGreaterThan(r.get("b")!);
  });

  it("não inverte uma diferença grande de texto", () => {
    // 0,06 desempata vizinhos; não faz uma ferramenta fraca ganhar de uma forte.
    const distante = new Map([["a", 0.40], ["b", 0.75]]);
    const r = aplicarAprendizado(distante, new Map([["a", MAX_BONUS]]));
    expect(r.get("b")!).toBeGreaterThan(r.get("a")!);
  });

  it("NÃO ressuscita ferramenta fora do turno", () => {
    // O recorte de assunto e a permissão são decisões de segurança; histórico é
    // estatística, e estatística não fura filtro.
    const r = aplicarAprendizado(sim, new Map([["proibida", MAX_BONUS]]));
    expect(r.has("proibida")).toBe(false);
  });

  it("não passa de 1", () => {
    expect(aplicarAprendizado(new Map([["a", 0.99]]), new Map([["a", MAX_BONUS]])).get("a")).toBe(1);
  });

  it("sem bônus devolve o mesmo mapa", () => {
    expect(aplicarAprendizado(sim, new Map())).toBe(sim);
  });
});
