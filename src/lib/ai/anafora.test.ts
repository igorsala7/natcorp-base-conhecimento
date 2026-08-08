import { describe, it, expect } from "vitest";
import { deveReescrever } from "./rewrite-gate";

/**
 * `precisaContexto` é o sinal que impede a análise profunda de disparar sobre a
 * coluna do relatório quando a pergunta aponta para a CONVERSA.
 *
 * Caso real: depois de seis turnos sobre o Bruno Cirilo, "Como você avalia a
 * trajetória DESSE colaborador?" fez o classificador escolher a coluna
 * "COLABORADOR" da tela e propor ler 109 registros.
 */
const base = {
  social: false, baseExclusiva: false, modoRelatorioCedo: false,
  temTelaAtiva: true, perguntaComposta: false, mensagensDoUsuario: 6,
};

describe("precisaContexto — a pergunta aponta para a conversa?", () => {
  const anaforicas = [
    "Como você avalia a trajetória desse colaborador?",
    "E as férias dele?",
    "Me traga os dados dessa pessoa",
    "Faz um resumo disso",
    "E em abril?",
  ];
  for (const q of anaforicas) {
    it(`depende do histórico: "${q}"`, () => {
      expect(deveReescrever({ ...base, question: q }).precisaContexto).toBe(true);
    });
  }

  const autonomas = [
    "Quantos colaboradores por motivo de afastamento estão registrados no relatório?",
    "Quais são os cargos com maior valor de desconto em março de 2025?",
  ];
  for (const q of autonomas) {
    it(`não depende: "${q.slice(0, 40)}"`, () => {
      expect(deveReescrever({ ...base, question: q }).precisaContexto).toBe(false);
    });
  }

  it("sem histórico, nada é anafórico — 1º turno não tem a que se referir", () => {
    expect(deveReescrever({ ...base, mensagensDoUsuario: 1, question: "Como você avalia a trajetória desse colaborador?" }).precisaContexto).toBe(false);
  });
});
