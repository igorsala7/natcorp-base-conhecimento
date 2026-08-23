import { describe, it, expect } from "vitest";
import { perguntaDeEntrega } from "./entrega";
import { respostaFaltaPeriodo } from "./periodo";

/**
 * O CONTRATO ENTRE O GATE E O BOTÃO.
 *
 * O widget renderiza cada opção com `b.textContent = o.label`. Os gates emitem em
 * DOIS formatos — objeto `{label}` e STRING pura —, e a string virava `undefined`:
 * três retângulos vazios na tela, sem como escolher.
 *
 * Aconteceu na sessão de 23/08 e o dono reclamou duas vezes, com estas palavras:
 *   "Os botões estão sem informação, está em branco."
 *   "De novo??? … E os botões vieram em brando novamente"
 *
 * O conserto ficou no widget (normaliza string → {label, value}), que cobre todos os
 * gates de uma vez. Este teste guarda o outro lado: se um gate passar a emitir algo
 * que não seja string nem `{label}`, ele quebra aqui e não na cara do usuário.
 */
const rotulo = (o: unknown): string | undefined =>
  typeof o === "string" ? o : (o as { label?: string })?.label;

describe("opções de gate viram botão com texto", () => {
  it("portão de entrega — o caso que apareceu em branco", () => {
    const p = perguntaDeEntrega(10149);
    expect(p.opcoes.length).toBeGreaterThan(0);
    for (const o of p.opcoes) {
      const r = rotulo(o);
      expect(r, `opção sem rótulo: ${JSON.stringify(o)}`).toBeTruthy();
      expect(String(r).trim()).not.toBe("");
    }
    // O número de linhas aparece na pergunta — é o que justifica perguntar.
    expect(p._perguntar).toContain("10149");
  });

  it("portão de período — mesmo formato de string, mesmo risco", () => {
    const p = respostaFaltaPeriodo(new Date("2026-08-23T12:00:00Z"));
    expect(p.opcoes.length).toBeGreaterThan(0);
    for (const o of p.opcoes) expect(String(rotulo(o) ?? "").trim()).not.toBe("");
  });

  it("a normalização do widget aceita os dois formatos", () => {
    const normalizar = (o: unknown) => (typeof o === "string" ? { label: o, value: o } : o);
    expect(normalizar("PDF")).toEqual({ label: "PDF", value: "PDF" });
    expect(normalizar({ label: "Férias", scope: { tool: "x" } })).toEqual({
      label: "Férias", scope: { tool: "x" },
    });
  });
});
