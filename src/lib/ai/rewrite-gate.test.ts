import { describe, it, expect } from "vitest";
import { comAntecedente, deveReescrever, reescritaPerdeuAPergunta, type EntradaGate } from "./rewrite-gate";

const base: EntradaGate = {
  question: "quantos colaboradores estão de férias em março?",
  mensagensDoUsuario: 1,
  social: false, baseExclusiva: false,
  temTelaAtiva: true, perguntaComposta: false, modoRelatorioCedo: false,
};
const com = (p: Partial<EntradaGate>): EntradaGate => ({ ...base, ...p });

/**
 * O gate antigo pulava a reescrita sempre que havia tabela na tela — o caso NORMAL
 * num relatório do APEX. Follow-ups anafóricos chegavam crus ao embedding que escolhe
 * as ferramentas, e nenhuma casava.
 */
describe("deveReescrever", () => {
  it("1º turno com tela: pula (custo zero na maioria dos turnos)", () => {
    const r = deveReescrever(base);
    expect(r.pular).toBe(true);
    expect(r.motivo).toBe("tela_ativa");
  });

  const followups = ["e em abril?", "e do time do João?", "e o do mês passado", "agora os afastados", "e dela?"];
  for (const q of followups) {
    it(`follow-up com histórico roda a reescrita: "${q}"`, () => {
      const r = deveReescrever(com({ question: q, mensagensDoUsuario: 3 }));
      expect(r.pular, q).toBe(false);
      expect(r.precisaContexto, q).toBe(true);
    });
  }

  it("follow-up SEM histórico continua pulando (não há antecedente)", () => {
    expect(deveReescrever(com({ question: "e em abril?", mensagensDoUsuario: 1 })).pular).toBe(true);
  });

  it("pergunta longa e autossuficiente com tela: pula (sem latência nova)", () => {
    const q = "quero saber quantos colaboradores da filial 97 estão com férias vencidas neste mês";
    expect(deveReescrever(com({ question: q, mensagensDoUsuario: 4 })).pular).toBe(true);
  });

  it("social e base exclusiva são absolutos", () => {
    expect(deveReescrever(com({ social: true, question: "e em abril?", mensagensDoUsuario: 3 })).motivo).toBe("social");
    expect(deveReescrever(com({ baseExclusiva: true, question: "e em abril?", mensagensDoUsuario: 3 })).motivo).toBe("base_exclusiva");
  });

  it("sem tela e sem modo relatório: reescreve normalmente", () => {
    expect(deveReescrever(com({ temTelaAtiva: false })).pular).toBe(false);
  });
});

describe("comAntecedente", () => {
  it("cola o turno anterior para o vetor ter assunto", () => {
    expect(comAntecedente("e em abril?", "quantos estão de férias em março?")).toBe(
      "e em abril?\nquantos estão de férias em março?",
    );
  });

  it("sem antecedente, devolve intacto", () => {
    expect(comAntecedente("e em abril?", undefined)).toBe("e em abril?");
  });

  it("corta o antecedente para não diluir o vetor", () => {
    expect(comAntecedente("e?", "x".repeat(500)).length).toBeLessThan(140);
  });
});

describe("reescritaPerdeuAPergunta", () => {
  it("o caso real: a pergunta virou o título da tela", () => {
    expect(reescritaPerdeuAPergunta("Compara com o mês de Abril", "Recibo de Pagamento")).toBe(true);
    expect(reescritaPerdeuAPergunta("Mas eu quero no geral", "Linha do tempo dos funcionários")).toBe(true);
    expect(reescritaPerdeuAPergunta("Fiquei decepcionado com seu resultado", "Gerador de Relatórios")).toBe(true);
  });

  it("esclarecer NÃO é substituir — precisa sobrar alguma palavra da pergunta", () => {
    expect(reescritaPerdeuAPergunta("quanto ganho de salário", "salário remuneração")).toBe(false);
    expect(reescritaPerdeuAPergunta("marcações do Tony em agosto", "marcações de ponto Tony agosto")).toBe(false);
    expect(reescritaPerdeuAPergunta("férias do 205818", "consultar férias matrícula 205818")).toBe(false);
  });

  it("na dúvida NÃO bloqueia — sem palavra de conteúdo, segue como antes", () => {
    expect(reescritaPerdeuAPergunta("sim", "Recibo de Pagamento")).toBe(false);
    expect(reescritaPerdeuAPergunta("Compara com abril", "")).toBe(false);
  });
});
