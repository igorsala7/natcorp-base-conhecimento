import { describe, it, expect } from "vitest";
import { ehConversaSocial, separarSocial, ehTurnoSocial } from "./social";

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

/**
 * A palavra de cortesia na frente não pode custar o turno inteiro.
 *
 * `"Olá, como você pode me ajudar?"` gastava 30.426 tokens e 12,5 s (medido em
 * 18/08/2026) porque a saudação deixava um "resto", e a existência do resto —
 * sozinha — desligava o atalho social.
 */
describe("ehTurnoSocial", () => {
  it("saudação + pergunta que também é social continua social", () => {
    expect(ehTurnoSocial("Olá, como você pode me ajudar?")).toBe(true);
    expect(ehTurnoSocial("Oi, tudo bem?")).toBe(true);
    // A MESMA frase sem a saudação sempre foi social — era a incoerência.
    expect(ehConversaSocial("como você pode me ajudar?")).toBe(true);
  });

  it("saudação + PEDIDO REAL não é social — o caso que a separação existe para pegar", () => {
    expect(ehTurnoSocial("obrigado! agora me diz quantos estão de férias")).toBe(false);
    expect(ehTurnoSocial("Olá, preciso dos dados da minha equipe")).toBe(false);
    expect(ehTurnoSocial("bom dia, qual o meu saldo de férias?")).toBe(false);
  });

  it("cortesia pura continua social", () => {
    for (const s of ["Olá", "oi", "bom dia", "obrigado", "valeu!"]) {
      expect(ehTurnoSocial(s)).toBe(true);
    }
  });

  it("pergunta de trabalho sem cortesia nenhuma não é social", () => {
    expect(ehTurnoSocial("quantos colaboradores estão de férias?")).toBe(false);
    expect(ehTurnoSocial("jornada")).toBe(false);
  });

  it("vazio não quebra", () => {
    expect(ehTurnoSocial("")).toBe(false);
    expect(ehTurnoSocial("   ")).toBe(false);
  });
});
