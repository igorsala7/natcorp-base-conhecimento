import { describe, it, expect } from "vitest";
import { ehCorrecao, sinalDoTurnoSeguinte } from "./correcao";

/**
 * Os POSITIVOS são frases reais, copiadas dos traces de produção.
 * Os NEGATIVOS pesam mais: este sinal ordena a fila de quem vai rotular à mão, e
 * marcar um turno bom desperdiça a atenção da pessoa — que é o recurso caro. Na
 * dúvida o detector deve ficar calado; um erro não marcado só espera na fila
 * normal, um acerto marcado errado rouba o tempo de quem julga.
 */
describe("ehCorrecao — positivos reais de produção", () => {
  const reais = [
    "Você não fez o word",
    "Você não entendeu... pra cada colaborador, em determinadas datas tiveram ajustes",
    "Mas eu não pedi amostra, eu quero que seja consultado em cima de todos",
    "De novo??? Eu estou falando que é só da minha equipe!",
    "Mas eu pedi da evolução salarial, ou seja, do histórico de salários deles",
    // Texto integral: o "???" é o contraste que faz a reafirmação contar. Truncar a
    // frase no teste tirava o marcador e escondia que o detector estava certo.
    "Estou falando do resultado anterior, da onde você está tirando que estou pedindo de todos os colaboradores da empresa??? Está com amnésia???",
    "Mas eu sou gestor, quero os colaboradores que eu gerencio",
    "Mas eu disse 01/11 e 01/12",
    "Mas eu desde o início estou pedindo \"Quais\", não pedi consolidado",
    "Eu não pedi pra gerar novamente, só dei um feedback de que funcionou",
  ];
  for (const m of reais) {
    it(`marca: "${m.slice(0, 46)}"`, () => expect(ehCorrecao(m)).toBe(true));
  }
});

describe("ehCorrecao — o que NÃO pode disparar", () => {
  const limpos = [
    // "mas" de continuação, não de discordância — o risco principal do detector.
    "Do jeito que estão os eventos dele, e se eu desligá-lo, teremos risco trabalhista?",
    "Mas e se eu quiser o mês passado?",
    "Mas quantos são no total?",
    // Pedido novo com "quero" — é o normal, não conserto.
    "Quero ver as marcações de ponto da minha equipe",
    "Eu quero o relatório de férias",
    "Me traga os dados de banco de horas deles",
    // Perguntas comuns.
    "Quantas faltas do Tony?",
    "E os atrasos?",
    "Acumulado de 2026",
    "obrigado",
    "Olá",
  ];
  for (const m of limpos) {
    it(`não marca: "${m.slice(0, 46)}"`, () => expect(ehCorrecao(m)).toBe(false));
  }
});

describe("ehCorrecao — bordas", () => {
  it("primeiro turno da conversa não corrige nada", () => {
    expect(ehCorrecao("Você não entendeu", false)).toBe(false);
  });
  it("mensagem vazia ou curta demais", () => {
    expect(ehCorrecao("")).toBe(false);
    expect(ehCorrecao("ok")).toBe(false);
  });
  it("acento não muda o resultado", () => {
    expect(ehCorrecao("Voce nao entendeu o que eu pedi")).toBe(true);
    expect(ehCorrecao("Você não entendeu o que eu pedi")).toBe(true);
  });
  it("o sinal nomeado acompanha a decisão", () => {
    expect(sinalDoTurnoSeguinte("Você não fez o word")).toBe("corrigido_pelo_usuario");
    expect(sinalDoTurnoSeguinte("E os atrasos?")).toBeNull();
  });
});
