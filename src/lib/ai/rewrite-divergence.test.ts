import { describe, it, expect } from "vitest";
import { reescritaDivergente } from "./rewrite-divergence";

describe("reescritaDivergente", () => {
  // O caso real (natcorp, 12/08/2026): a reescrita trocou a pergunta por uma
  // funcionalidade do RH e a agenda do Microsoft 365 sumiu da seleção.
  it("acusa quando a reescrita não guarda nada do que foi perguntado", () => {
    expect(reescritaDivergente("Quais são meus compromissos desse mês?", "Minha linha do tempo")).toBe(true);
  });

  it("não acusa quando a reescrita PRESERVA os termos e acrescenta vocabulário", () => {
    expect(reescritaDivergente("meus compromissos", "compromissos da agenda do Outlook")).toBe(false);
    expect(reescritaDivergente("minhas férias vencidas", "saldo de férias vencidas e proporcionais")).toBe(false);
  });

  // Troca total por sinônimos do domínio ("ganho" → "remuneração") também conta
  // como divergência, e está certo: o teste aqui é sobre o que SOBROU do que a
  // pessoa escreveu, não sobre a qualidade da reescrita. A consequência é uma
  // faceta a mais — um embedding — e nunca uma ferramenta perdida.
  it("troca completa por sinônimos também mantém a original no jogo", () => {
    expect(
      reescritaDivergente("Quanto ganho por mês?", "Qual é a minha remuneração mensal (salário)?"),
    ).toBe(true);
  });

  it("plural e flexão não contam como divergência", () => {
    expect(reescritaDivergente("meu compromisso de amanhã", "compromissos agendados")).toBe(false);
  });

  it("palavras de ligação sozinhas não sustentam semelhança", () => {
    // "meus"/"desse"/"mês" são as únicas em comum — e nenhuma diz o assunto.
    expect(reescritaDivergente("Quais são meus dados desse mês?", "Minha linha do tempo")).toBe(true);
  });

  it("texto sem conteúdo não vira divergência (nada a preservar)", () => {
    expect(reescritaDivergente("oi", "saudação")).toBe(false);
    expect(reescritaDivergente("", "qualquer coisa")).toBe(false);
  });
});
