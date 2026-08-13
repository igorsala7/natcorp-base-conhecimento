import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * A impressão digital da confirmação não pode depender da ORDEM em que o modelo
 * emitiu os argumentos.
 *
 * Numa criação de férias real (13/08/2026) a pessoa disse "sim" QUATRO vezes
 * para um ato só: a cada nova tentativa o modelo reemitia os 25 parâmetros numa
 * ordem diferente, a digital mudava, e o guard abria uma pendência nova. Cada
 * "sim" a mais ensina a confirmar sem ler — que é o oposto do que o guard existe
 * para fazer.
 */
describe("confirmation_detalhada — digital estável", () => {
  it("ordena os argumentos por nome antes de montar o resumo", () => {
    const src = readFileSync("src/lib/integrations/guards.ts", "utf8");
    const trecho = src.slice(src.indexOf("async function detailedConfirmation"));
    const laco = trecho.slice(0, trecho.indexOf("const resumo"));
    expect(laco).toMatch(/\.sort\(/);
  });

  it("mesma ação com os argumentos em ordem diferente gera o MESMO resumo", () => {
    // Reproduz o miolo: o resumo sai de Object.entries ORDENADO.
    const resumo = (args: Record<string, unknown>) =>
      Object.entries(args)
        .sort(([a], [b]) => a.localeCompare(b))
        .filter(([, v]) => String(v ?? "").trim() !== "")
        .map(([k, v]) => `${k}: ${v}`)
        .join(" · ");

    const a = resumo({ matricula: 1, dt_saida_1: "2026-10-01", num_dias_1: 15 });
    const b = resumo({ num_dias_1: 15, matricula: 1, dt_saida_1: "2026-10-01" });
    expect(a).toBe(b);
  });
});
