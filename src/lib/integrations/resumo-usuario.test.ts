import { describe, it, expect } from "vitest";
import { limparResumo, MAX_DESC_USUARIO } from "./resumo-usuario";

describe("limparResumo", () => {
  it("passa reto no que já está limpo", () => {
    const s = "Mostra os períodos de férias já marcados e o saldo de dias do colaborador.";
    expect(limparResumo(s)).toBe(s);
  });

  it("tira rótulo, aspas e marcador de lista que o modelo às vezes acrescenta", () => {
    expect(limparResumo('Descrição: "Consulta o saldo de férias."')).toBe("Consulta o saldo de férias.");
    expect(limparResumo("- Mostra as marcações de ponto do mês.")).toBe("Mostra as marcações de ponto do mês.");
    expect(limparResumo("1. Mostra o holerite.")).toBe("Mostra o holerite.");
  });

  it("junta a resposta que veio quebrada em linhas", () => {
    expect(limparResumo("Mostra o holerite do mês.\nInclui descontos e proventos.")).toBe(
      "Mostra o holerite do mês. Inclui descontos e proventos.",
    );
  });

  it("descarta bloco de código", () => {
    expect(limparResumo("```json\n{}\n```\nMostra o saldo.")).toBe("Mostra o saldo.");
  });

  it("corta na FRONTEIRA DE FRASE — cortar no meio da palavra é o defeito que este campo existe para consertar", () => {
    const duas =
      "Primeira frase completa e razoavelmente longa para ocupar bastante espaço no campo de descricao. " +
      "Segunda frase que estoura o limite de duzentos e vinte caracteres e portanto precisa ser descartada inteira sem deixar rastro nenhum.";
    const r = limparResumo(duas);
    expect(r.length).toBeLessThanOrEqual(MAX_DESC_USUARIO);
    expect(r.endsWith(".")).toBe(true);
    expect(r).not.toContain("Segunda frase");
  });

  it("sem fronteira de frase utilizável, corta na palavra inteira e sinaliza", () => {
    const r = limparResumo("palavra ".repeat(60));
    expect(r.length).toBeLessThanOrEqual(MAX_DESC_USUARIO + 1);
    expect(r.endsWith("…")).toBe(true);
    expect(r).toMatch(/palavra…$/); // nunca cortada no meio
  });

  it("entrada vazia ou lixo vira string vazia (o chamador trata como falha)", () => {
    expect(limparResumo("")).toBe("");
    expect(limparResumo("   \n  ")).toBe("");
  });
});
