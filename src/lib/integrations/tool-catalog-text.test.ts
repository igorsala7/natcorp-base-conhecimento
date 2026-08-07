import { describe, it, expect } from "vitest";
import { semOrquestracao } from "./tool-catalog-text";

/**
 * Caso real: "quero o histórico financeiro detalhado desse período da Ana Silva"
 * trouxe o RECIBO DE PAGAMENTO. A descrição do recibo não fala de histórico
 * financeiro em lugar nenhum — exceto na frase de orquestração "Consulte
 * `historico_financeiro_meses` para os meses válidos", que ia inteira para o vetor.
 */
describe("semOrquestracao", () => {
  const chaves = new Set(["historico_financeiro", "historico_financeiro_meses", "relatorio_recibo_pagamento", "meus_dados"]);

  it("tira a frase que cita outra ferramenta, preservando o resto", () => {
    const d = "Gera o recibo de pagamento (holerite/contracheque) do colaborador em um mês de referência. " +
      "Retorna o PDF para download. Consulte `historico_financeiro_meses` para os meses válidos.";
    const r = semOrquestracao(d, chaves);
    expect(r).toContain("recibo de pagamento");
    expect(r).toContain("PDF para download");
    // O termo que roubava a pergunta some do vetor.
    expect(r.toLowerCase()).not.toContain("historico_financeiro");
    expect(r.toLowerCase()).not.toContain("meses válidos");
  });

  it("a ferramenta CERTA mantém o assunto dela", () => {
    const d = "Eventos financeiros (proventos e descontos) do colaborador. Para um período, informe periodo_ini e periodo_fim. " +
      "Se o usuário não indicou um mês, liste os disponíveis com historico_financeiro_meses antes.";
    const r = semOrquestracao(d, new Set(["historico_financeiro_meses", "relatorio_recibo_pagamento"]));
    expect(r).toContain("Eventos financeiros");
    expect(r).toContain("proventos e descontos");
    expect(r).not.toContain("historico_financeiro_meses");
  });

  it("não corta quando a frase não cita ferramenta nenhuma", () => {
    const d = "Lista os meses disponíveis para consulta do histórico financeiro / recibo de pagamento.";
    expect(semOrquestracao(d, chaves)).toBe(d);
  });

  it("a própria chave não conta (o chamador a remove do conjunto)", () => {
    const d = "Retorna meus_dados do usuário logado.";
    expect(semOrquestracao(d, new Set(["outra_tool"]))).toBe(d);
  });

  it("sem chaves, devolve intacto", () => {
    const d = "Consulte `historico_financeiro_meses` antes.";
    expect(semOrquestracao(d, new Set())).toBe(d);
  });

  it("texto vazio não quebra", () => {
    expect(semOrquestracao("", chaves)).toBe("");
    expect(semOrquestracao(null as unknown as string, chaves)).toBe("");
  });

  it("nunca apaga o texto inteiro quando TODAS as frases citam ferramenta", () => {
    // Degenerado, mas possível: aí o vetor fica só com nome + search_terms.
    const d = "Use historico_financeiro. Depois relatorio_recibo_pagamento.";
    expect(semOrquestracao(d, chaves)).toBe("");
  });
});
