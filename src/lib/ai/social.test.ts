import { describe, it, expect } from "vitest";
import { ehConversaSocial } from "./social";

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
