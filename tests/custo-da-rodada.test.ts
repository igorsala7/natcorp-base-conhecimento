import { describe, it, expect } from "vitest";
import { estimarCusto, type Preco } from "../scripts/custo-da-rodada";

/**
 * Esta é a proteção que já falhou uma vez: em 20/08/2026 uma rodada de eval
 * esgotou o crédito da Anthropic e derrubou a produção, porque os scripts
 * chamam os provedores direto e o gasto não passa por `ai_usage`.
 *
 * O teste que importa aqui não é o da aritmética — é o do MODELO SEM PREÇO.
 * Ele custa dinheiro de verdade e entra na estimativa como zero, então o teto
 * deixa de valer exatamente na rodada que ninguém conseguiria prever. Um
 * `usd === 0` não distingue "não tem preço" de "zero casos", e foi por isso que
 * a flag virou campo próprio.
 */
const PRECOS: Preco[] = [
  { provider: "google", model: "gemini-3.6-flash", pin: 1.5, pout: 7.5, mr: 0.1, mw: 1 },
  { provider: "anthropic", model: "claude-fable-5", pin: 10, pout: 50, mr: 0.1, mw: 1 },
];

describe("estimarCusto", () => {
  it("marca `semPreco` no modelo que não está na tabela", () => {
    const { porModelo } = estimarCusto(["openai:gpt-5.4"], 50, 11_000, PRECOS);
    expect(porModelo[0]!.semPreco).toBe(true);
    expect(porModelo[0]!.usd).toBe(0);
  });

  it("`semPreco` é FALSO com zero casos — o custo zero ali é legítimo", () => {
    // A distinção que a versão antiga não fazia: ela inferia "sem preço" de
    // `usd === 0` e acusava todo modelo numa rodada de 0 casos.
    const { porModelo } = estimarCusto(["google:gemini-3.6-flash"], 0, 11_000, PRECOS);
    expect(porModelo[0]!.semPreco).toBe(false);
    expect(porModelo[0]!.usd).toBe(0);
  });

  it("o modelo sem preço NÃO infla o total — é justamente o risco", () => {
    // O total fica igual com e sem ele: quem olhar só o total não vê o gasto.
    const so = estimarCusto(["google:gemini-3.6-flash"], 50, 11_000, PRECOS);
    const com = estimarCusto(["google:gemini-3.6-flash", "openai:gpt-5.4"], 50, 11_000, PRECOS);
    expect(com.total).toBeCloseTo(so.total, 10);
    expect(com.porModelo.filter((m) => m.semPreco)).toHaveLength(1);
  });

  it("modelo caro pesa muito mais que o barato, na mesma rodada", () => {
    const { porModelo } = estimarCusto(
      ["google:gemini-3.6-flash", "anthropic:claude-fable-5"], 37, 11_000, PRECOS,
    );
    const barato = porModelo.find((m) => m.spec.includes("gemini"))!.usd;
    const caro = porModelo.find((m) => m.spec.includes("fable"))!.usd;
    expect(caro).toBeGreaterThan(barato * 5);
  });

  it("escala com casos e com tokens", () => {
    const a = estimarCusto(["google:gemini-3.6-flash"], 10, 11_000, PRECOS).total;
    const b = estimarCusto(["google:gemini-3.6-flash"], 20, 11_000, PRECOS).total;
    const c = estimarCusto(["google:gemini-3.6-flash"], 10, 22_000, PRECOS).total;
    expect(b).toBeCloseTo(a * 2, 10);
    expect(c).toBeCloseTo(a * 2, 10);
  });
});
