import { describe, it, expect } from "vitest";
import { antecedenteDoTurno, ultimaDoUsuario, antecedenteLigado } from "./antecedente";

/**
 * As mensagens dos positivos são reais, tiradas dos traces e do gabarito. São as
 * que o funil resolve e o modelo não: o funil recebe "Tudo junto" colado ao
 * antecedente e escolhe `linha_tempo`; o modelo recebe "Tudo junto" sozinho e
 * responde em texto.
 *
 * Os NEGATIVOS pesam igual. O bloco toca 33% dos turnos (477 de 1.424 medidos),
 * e antecedente errado é pior que antecedente nenhum: numa pergunta autônoma ele
 * ancoraria o modelo num assunto que a pessoa já deixou para trás.
 */
const u = (content: string) => ({ role: "user", content });
const a = (content: string) => ({ role: "assistant", content });

describe("ultimaDoUsuario", () => {
  it("pega a fala anterior, não a atual", () => {
    const msgs = [u("Me traga o histórico de cargos e salários"), a("Aqui está…"), u("Tudo junto")];
    expect(ultimaDoUsuario("Tudo junto", msgs)).toBe("Me traga o histórico de cargos e salários");
  });

  it("primeiro turno não tem antecedente", () => {
    expect(ultimaDoUsuario("Olá", [u("Olá")])).toBeUndefined();
  });

  it("usa a MESMA expressão do funil — se divergir, o defeito volta calado", () => {
    // Espelha `route.ts:790`: última do usuário cujo conteúdo != a pergunta atual.
    const msgs = [u("primeira"), a("resposta"), u("segunda"), a("resposta"), u("atual")];
    expect(ultimaDoUsuario("atual", msgs)).toBe("segunda");
  });
});

describe("antecedenteDoTurno", () => {
  it("os casos reais que o modelo erra hoje", () => {
    const casos: [string, string, string][] = [
      ["Tudo junto", "Me traga o histórico de cargos e salários de cada um", "histórico de cargos"],
      ["Ao tony mesmo", "Como você avalia a trajetória desse colaborador?", "trajetória"],
      ["excel", "Me retorne os colaboradores da área de RH", "colaboradores"],
    ];
    for (const [pergunta, anterior, pedaco] of casos) {
      const bloco = antecedenteDoTurno(pergunta, [u(anterior), a("…"), u(pergunta)]);
      expect(bloco, `"${pergunta}" devia trazer o antecedente`).toContain(pedaco);
      // Rotulado como leitura do SISTEMA — o modelo não pode achar que a pessoa
      // escreveu isso agora.
      expect(bloco).toContain("leitura do sistema");
    }
  });

  it("NÃO repete a pergunta atual dentro do bloco", () => {
    const bloco = antecedenteDoTurno("Tudo junto", [u("Me traga o histórico"), a("…"), u("Tudo junto")]);
    expect(bloco.startsWith("Tudo junto")).toBe(false);
  });

  it("sem antecedente devolve vazio — o compositor omite o bloco", () => {
    expect(antecedenteDoTurno("Olá", [u("Olá")])).toBe("");
    expect(antecedenteDoTurno("Olá", [])).toBe("");
  });

  it("corta o antecedente longo (o teto de `comAntecedente` é 120)", () => {
    const longo = "x".repeat(500);
    const bloco = antecedenteDoTurno("e?", [u(longo), a("…"), u("e?")]);
    // rótulo curto (~48) + teto de 120 do `comAntecedente` + aspas
    expect(bloco.length).toBeLessThan(180);
  });
});

describe("interruptor", () => {
  it("ligado por padrão, desliga com ANTECEDENTE_NO_MODELO=0", () => {
    const antes = process.env.ANTECEDENTE_NO_MODELO;
    delete process.env.ANTECEDENTE_NO_MODELO;
    expect(antecedenteLigado()).toBe(true);
    process.env.ANTECEDENTE_NO_MODELO = "0";
    expect(antecedenteLigado()).toBe(false);
    if (antes === undefined) delete process.env.ANTECEDENTE_NO_MODELO;
    else process.env.ANTECEDENTE_NO_MODELO = antes;
  });
});
