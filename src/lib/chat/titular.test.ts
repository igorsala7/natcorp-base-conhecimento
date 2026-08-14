import { describe, it, expect } from "vitest";
import { conferirTitular, nomesNaPergunta, nomesNoRetorno, avisoDivergencia } from "./titular";

/** O caso real de 14/08/2026, com os nomes que apareceram. */
const PERGUNTA = "Qual é o histórico de cargos, salários e as férias de TONY OLIVEIRA?";
const linha = (nome: string) => ({ empresa: 700, colaborador: nome, fato: "CARGO" });

describe("conferirTitular", () => {
  it("PEGA o caso que aconteceu: pediu Tony, voltou Sidnei", () => {
    const d = conferirTitular(PERGUNTA, { items: [linha("SIDNEI CARVALHO")] })!;
    expect(d.pedido).toBe("tony oliveira");
    expect(d.veio).toContain("sidnei carvalho");
  });

  it("deixa passar quando é a pessoa certa", () => {
    expect(conferirTitular(PERGUNTA, { items: [linha("TONY OLIVEIRA")] })).toBeNull();
  });

  it("aceita nome mais completo no retorno", () => {
    // O cadastro costuma ter o nome inteiro; a pergunta, o usual.
    expect(conferirTitular(PERGUNTA, { items: [linha("TONY DE OLIVEIRA SILVA")] })).toBeNull();
  });

  it("acento e caixa não criam divergência", () => {
    expect(conferirTitular("férias de Ana Silva", { items: [{ nome: "ANA SÍLVIA" }] })).not.toBeNull();
    expect(conferirTitular("férias de Ana Silva", { items: [{ nome: "ana silva" }] })).toBeNull();
  });

  it("basta UM dos pedidos bater", () => {
    // "férias do Tony e da Ana" traz os dois; não é divergência.
    const q = "férias de Tony Oliveira e de Ana Silva";
    expect(conferirTitular(q, { items: [linha("ANA SILVA")] })).toBeNull();
  });
});

describe("conferirTitular — o silêncio nos casos duvidosos", () => {
  it("pergunta sem nome não dispara", () => {
    // A maioria das consultas é legítima e não menciona ninguém.
    expect(conferirTitular("quantos colaboradores ativos?", { items: [linha("QUALQUER UM")] })).toBeNull();
  });

  it("primeiro nome sozinho não dispara", () => {
    // "Tony" isolado gera homônimo — alarme falso trava resposta boa.
    expect(conferirTitular("férias do Tony", { items: [linha("SIDNEI CARVALHO")] })).toBeNull();
  });

  it("retorno sem campo de nome não dispara", () => {
    expect(conferirTitular(PERGUNTA, { items: [{ empresa: 700, salario: 10 }] })).toBeNull();
  });

  it("retorno vazio não dispara", () => {
    expect(conferirTitular(PERGUNTA, { items: [] })).toBeNull();
    expect(conferirTitular(PERGUNTA, null)).toBeNull();
  });
});

describe("extração", () => {
  it("ignora tratamento e palavra de pergunta", () => {
    expect(nomesNaPergunta("Qual o salário da Dra. Ana Silva?")).toContain("ana silva");
  });

  it("lê o nome em qualquer um dos campos usuais", () => {
    expect(nomesNoRetorno({ itens: [{ nome_colaborador: "Joao Souza" }] })).toEqual(["joao souza"]);
    expect(nomesNoRetorno([{ colaborador: "Maria Lima" }])).toEqual(["maria lima"]);
  });
});

describe("avisoDivergencia", () => {
  it("proíbe apresentar e proíbe trocar o nome", () => {
    const t = avisoDivergencia({ pedido: "tony oliveira", veio: ["sidnei carvalho"] });
    expect(t).toMatch(/NÃO apresente estes dados/);
    expect(t).toMatch(/NÃO troque o nome da resposta/);
    expect(t).toContain("tony oliveira");
    expect(t).toContain("sidnei carvalho");
  });
});
