import { describe, it, expect } from "vitest";
import { intencaoDocumental } from "./intencao-documental";

/**
 * As perguntas abaixo são REAIS, tiradas dos traces em que o modo relatório
 * carregou documentação. A coluna que importa é se a resposta citou fonte.
 */
describe("intencaoDocumental — o que CORTA no modo relatório", () => {
  const semDoc = [
    "Gere um gráfico",
    "Quantos colaboradores por centro de custo?",
    "Qual candidato é mais indicado para vaga de diretor financeiro?",
    "Qual candidato é melhor para a vaga de Analista de RH? Precisa morar em São Paulo",
    "Faça uma analise detalhada desse relatório",
    "Para essa empresa, quantos colaboradores são deste mesmo cargo?",
    "Quero meu histórico financeiro do mês de 05/2025",
    "Ok, me gere um pdf disso",
    "pode criar",
    "205818",
  ];
  for (const p of semDoc) {
    it(`corta: "${p.slice(0, 44)}"`, () => expect(intencaoDocumental(p)).toBe(false));
  }
});

describe("intencaoDocumental — o que PRESERVA", () => {
  const comDoc = [
    "O que esse programa faz?",              // real, do trace
    "Me ajude a utilizar o programa",        // real, do trace
    "Como faço para lançar hora extra?",
    "Qual a regra de banco de horas?",
    "Para que serve esse campo?",
    "Quando devo solicitar férias?",
    "Me explica o processo de admissão",
    "passo a passo para acessar a tela",
    "o que significa situação funcional?",
    "posso lançar falta abonada?",
    "qual o prazo para entregar o atestado?",
  ];
  for (const p of comDoc) {
    it(`preserva: "${p.slice(0, 44)}"`, () => expect(intencaoDocumental(p)).toBe(true));
  }

  it("vazio não é intenção de documentação", () => {
    expect(intencaoDocumental("")).toBe(false);
    expect(intencaoDocumental("   ")).toBe(false);
  });

  it("funciona sem acento — o usuário digita dos dois jeitos", () => {
    expect(intencaoDocumental("qual a politica de ferias?")).toBe(true);
    expect(intencaoDocumental("como faco para pedir ferias")).toBe(true);
  });
});
