import { describe, it, expect } from "vitest";
import { absoluto, relativo, carimbo } from "./quando";

// Relógio fixo: teste de data que depende de `Date.now()` falha sozinho de
// madrugada, e ninguém descobre por quê.
const AGORA = new Date("2026-08-16T21:30:00Z").getTime();
const t = (min: number) => new Date(AGORA - min * 60_000).toISOString();

describe("carimbo de quando", () => {
  it("O CASO QUE MOTIVOU: distinguir o erro da manhã do de agora", () => {
    // Um erro das 13:10 continuava visível às 18:13 e foi lido como falha do
    // arquivo que acabara de subir. Sem hora, não havia como desconfiar.
    expect(relativo(t(5), AGORA)).toBe("há 5 min");
    expect(relativo(t(310), AGORA)).toBe("há 5h");
  });

  it("os degraus", () => {
    expect(relativo(t(0), AGORA)).toBe("agora");
    expect(relativo(t(59), AGORA)).toBe("há 59 min");
    expect(relativo(t(90), AGORA)).toBe("há 2h");
    expect(relativo(t(60 * 24), AGORA)).toBe("ontem");
    expect(relativo(t(60 * 24 * 4), AGORA)).toBe("há 4 dias");
  });

  it("data no futuro não vira 'há -3 min'", () => {
    // Relógio do servidor adiantado é comum e não deveria produzir absurdo.
    expect(relativo(new Date(AGORA + 5 * 60_000).toISOString(), AGORA)).toBe("agora");
  });

  it("o absoluto traz dia e mês — '13:10' sozinho não diz qual dia", () => {
    expect(absoluto("2026-08-16T16:10:00Z")).toMatch(/16\/08/);
    expect(absoluto("2026-08-16T16:10:00Z")).toMatch(/\d{2}:\d{2}/);
  });

  it("entrada inválida devolve vazio, não 'Invalid Date'", () => {
    for (const v of [null, undefined, "", "não é data"]) {
      expect(absoluto(v)).toBe("");
      expect(relativo(v, AGORA)).toBe("");
    }
    expect(carimbo(null, AGORA)).toEqual({ absoluto: "", relativo: "" });
  });
});
