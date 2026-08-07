import { describe, it, expect } from "vitest";
import { ehConversaSocial, separarSocial } from "./social";

describe("ehConversaSocial", () => {
  it("reconhece saudações e conversa social", () => {
    for (const s of [
      "oi",
      "Olá",
      "olá!",
      "Bom dia",
      "boa tarde :)",
      "Oi, tudo bem?",
      "tudo bem?",
      "como vai?",
      "beleza?",
      "obrigado",
      "Obrigada pela ajuda!",
      "valeu",
      "tchau",
      "até mais",
    ]) {
      expect(ehConversaSocial(s), s).toBe(true);
    }
  });

  it("reconhece perguntas de identidade/meta sobre o assistente", () => {
    for (const q of [
      "Quem é vc?",
      "quem é você",
      "quem são vocês?",
      "o que você é?",
      "o que vc faz",
      "o que você pode fazer?",
      "com o que você pode ajudar?",
      "Como você pode me ajudar?",
      "como vc pode ajudar",
      "de que forma você me ajuda?",
      "em que você pode me ajudar",
      "no que vc ajuda",
      "você é um robô?",
      "vc é humano?",
      "você é uma IA",
      "qual é o seu nome?",
      "qual seu nome",
      "como você funciona?",
      "como você se chama",
      "quem te criou?",
    ]) {
      expect(ehConversaSocial(q), q).toBe(true);
    }
  });

  it("NÃO trata perguntas reais como social", () => {
    for (const q of [
      "como emito uma nota fiscal?",
      "oi, como faço para pedir férias?",
      "qual o prazo de pagamento",
      "preciso configurar o widget",
      "onde fica o relatório de vendas",
      "bom dia, como acesso o sistema?",
      "o que faz o sistema?",
      "o que faz o módulo financeiro",
      "você sabe onde fica o relatório?",
      "como você resolve o erro de login no sistema",
      "como você faz backup dos dados",
      "como ajudar um cliente novo",
    ]) {
      expect(ehConversaSocial(q), q).toBe(false);
    }
  });
});

/**
 * Regressão de altíssima frequência num chat de RH: a cauda livre da regex de
 * agradecimento engolia a pergunta real. "obrigado! agora me diz quantos estão de
 * férias" virava turno social e desligava o pipeline inteiro — RAG vazio, glossário
 * vazio, todos os gates pulados. O agente respondia "de nada!" e ignorava o pedido.
 */
describe("abertura social + pedido real", () => {
  const engolidas = [
    "obrigado! agora me diz quantos estão de férias",
    "perfeito, e o fechamento da folha?",
    "valeu, e o espelho de ponto do João?",
    "show, me traz os afastamentos de março",
    "ok, quantos colaboradores por cargo?",
    "bom dia, preciso do relatório de horas extras",
  ];
  for (const q of engolidas) {
    it(`NÃO é social: "${q}"`, () => {
      expect(ehConversaSocial(q), q).toBe(false);
      const { saudacao, resto } = separarSocial(q);
      expect(saudacao, q).toBeTruthy();
      expect(resto.length, q).toBeGreaterThan(3);
    });
  }

  const puras = ["obrigado", "obrigado!", "obrigado pela ajuda", "valeu mesmo", "muito obrigada :)", "perfeito", "bom dia", "tudo bem?"];
  for (const q of puras) {
    it(`continua social: "${q}"`, () => {
      expect(ehConversaSocial(q), q).toBe(true);
      expect(separarSocial(q).resto, q).toBe("");
    });
  }

  it("mensagem sem abertura social passa inteira como pedido", () => {
    const q = "quantos colaboradores estão de férias em março?";
    expect(separarSocial(q)).toEqual({ saudacao: "", resto: q });
  });

  it("cauda curta demais não vira pedido", () => {
    expect(separarSocial("obrigado :)").resto).toBe("");
  });
});
