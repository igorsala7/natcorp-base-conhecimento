import { describe, it, expect } from "vitest";
import { intencaoVisual } from "./report-tools";

/**
 * Regra do gate: pedido de FORMATO sobre dado JÁ coletado não pode disparar a
 * pergunta "de qual ferramenta você quer buscar?".
 *
 * As duas condições juntas importam — reproduzidas aqui como o predicado que o
 * route.ts monta (`intencaoVis && datasets.list.length > 0`).
 */
const pedidoDeFormato = (pergunta: string, temDataset: boolean) =>
  intencaoVisual(pergunta, []) && temDataset;

describe("pedido de formato com dado no turno", () => {
  // Frases reais do trace, todas depois de uma análise já entregue.
  const continuacoes = [
    "Agora gere um PPT e Word",
    "Crie um PDF com uma explicação para eu enviar para o chefe da área médica",
    "Agora em versão pdf",
    "Faça um pdf",
    "tenta novamente, não chegou o pdf",
    "Agora crie um word da analise que vc tinha feito",
  ];
  for (const p of continuacoes) {
    it(`não pergunta a fonte: "${p.slice(0, 46)}"`, () => {
      expect(pedidoDeFormato(p, true)).toBe(true);
    });
  }

  it("SEM dado no turno, o pedido de arquivo volta a ser pergunta de dados", () => {
    // "me gere um relatório de férias" sem nada coletado É um pedido de dados —
    // ali perguntar a fonte é o comportamento certo.
    expect(pedidoDeFormato("Me gere um relatório de férias", false)).toBe(false);
    expect(pedidoDeFormato("Agora gere um PPT e Word", false)).toBe(false);
  });

  it("pergunta de dados com dataset no turno continua podendo perguntar a fonte", () => {
    for (const p of ["Quantos colaboradores por centro de custo?", "Quero meu histórico financeiro", "Quem são os afastados?"])
      expect(pedidoDeFormato(p, true)).toBe(false);
  });
});
