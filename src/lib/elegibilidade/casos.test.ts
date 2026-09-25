import { describe, it, expect } from "vitest";
import { alcanca, type Identidade, type Regra } from "./index";
import corpus from "./casos.json";

// `regra` é `unknown` de propósito: o corpus carrega casos MALFORMADOS, que é
// exatamente o que o tipo `Regra` promete que não existe e o banco entrega.
type Caso = { nome: string; regra: unknown; identidade: Identidade; esperado: boolean };

/**
 * O MESMO arquivo que `scripts/verificar-elegibilidade.ts` roda contra
 * `public.elegivel`. Acrescentar caso aqui vale mais que acrescentar teste em
 * qualquer um dos dois lados, porque este é o único arquivo que os dois lêem.
 */
describe("corpus compartilhado, lado TypeScript", () => {
  const casos = corpus.casos as Caso[];

  it("tem casos", () => {
    expect(casos.length).toBeGreaterThan(28);
  });

  for (const c of casos) {
    it(c.nome, () => {
      expect(alcanca(c.regra as Regra, c.identidade)).toBe(c.esperado);
    });
  }
});
