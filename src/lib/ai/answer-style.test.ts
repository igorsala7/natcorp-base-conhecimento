import { describe, expect, it } from "vitest";
import { pedeRespostaAnalitica, notaRespostaAnalitica, respostaAnaliticaLigada } from "./answer-style";

describe("pedeRespostaAnalitica", () => {
  it("dispara nos pedidos de análise reais do widget", () => {
    for (const p of [
      "Faça uma análise desse relatório e me dê sugestões e pontos de atenção",
      "Faça uma análise do dashboard dessa tela",
      "De uma forma mais analítica pra que eu possa fazer essa conferência da folha, o que você me sugere? Quais são os riscos trabalhistas que estou correndo?",
      "Analise este relatório e me diga o que chama atenção.",
      "O que você recomenda para reduzir as horas extras?",
      "Qual o impacto disso na folha?",
      "Avalie a tendência do absenteísmo",
    ]) expect(pedeRespostaAnalitica(p), p).toBe(true);
  });

  it("não dispara na pergunta simples, que deve continuar curta", () => {
    for (const p of [
      "Olá",
      "Qual meu centro de custo?",
      "Quantos dias posso vender?",
      "Quais são os meus dados cadastrais?",
      "O que é período aquisitivo de férias?",
      "Aceito avaliação",
      "Qual é a soma total dos valores?",
    ]) expect(pedeRespostaAnalitica(p), p).toBe(false);
  });

  it("a nota proíbe inventar e manda buscar o dado antes de perguntar", () => {
    const n = notaRespostaAnalitica();
    expect(n).toMatch(/Nunca invente/);
    expect(n).toMatch(/ferramentas antes de pedir ao usuário/);
  });

  it("desliga sem deploy com RESPOSTA_ANALITICA=0", () => {
    const antes = process.env.RESPOSTA_ANALITICA;
    process.env.RESPOSTA_ANALITICA = "0";
    expect(respostaAnaliticaLigada()).toBe(false);
    delete process.env.RESPOSTA_ANALITICA;
    expect(respostaAnaliticaLigada()).toBe(true);
    if (antes !== undefined) process.env.RESPOSTA_ANALITICA = antes;
  });
});
