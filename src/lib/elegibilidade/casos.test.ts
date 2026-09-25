import { describe, it, expect } from "vitest";
import { alcanca, type Identidade, type Regra } from "./index";
import corpus from "./casos.json";

// `regra` E `identidade` são `unknown` de propósito: o corpus carrega casos
// MALFORMADOS dos dois lados, que é exatamente o que os tipos `Regra` e
// `Identidade` prometem que não existe e uma coluna `jsonb` entrega. A
// identidade ganhou casos não-texto em 25/09, quando se mediu que o predicado
// DERRUBAVA com número e o gêmeo em SQL não.
type Caso = { nome: string; regra: unknown; identidade: unknown; esperado: boolean };

/**
 * O MESMO arquivo que `scripts/verificar-elegibilidade.ts` roda contra
 * `public.elegivel`. Acrescentar caso aqui vale mais que acrescentar teste em
 * qualquer um dos dois lados, porque este é o único arquivo que os dois lêem.
 */
describe("corpus compartilhado, lado TypeScript", () => {
  const casos = corpus.casos as Caso[];

  it("tem casos", () => {
    expect(casos.length).toBeGreaterThan(40);
  });

  for (const c of casos) {
    it(c.nome, () => {
      expect(alcanca(c.regra as Regra, c.identidade as Identidade)).toBe(c.esperado);
    });
  }
});
