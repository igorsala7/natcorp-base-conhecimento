import { describe, it, expect } from "vitest";
import { aplicarTetoTools } from "./teto-tools";

const sim = (o: Record<string, number>) => new Map(Object.entries(o));

describe("quem fica quando a lista não cabe", () => {
  it("O CASO REAL: a dependência que resolve o parâmetro não pode cair", () => {
    // "colaboradores que trabalharam hoje em X unidade". `estrutura_filiais`
    // traduz "unidade X" num código e tem similaridade BAIXA com a pergunta —
    // por definição, porque ela fala de filiais e a pergunta fala de pessoas.
    // Antes ela era cortada e o modelo preenchia empresa/matrícula por não ter
    // como resolver a unidade.
    const r = aplicarTetoTools({
      candidatas: ["frequencia_detalhe", "espelho_ponto", "meus_dados", "bi_headcount", "linha_tempo", "colab_resumo", "estrutura_filiais"],
      dependencias: ["estrutura_filiais"],
      similaridade: sim({ frequencia_detalhe: 0.7, espelho_ponto: 0.66, meus_dados: 0.63, bi_headcount: 0.6, linha_tempo: 0.58, colab_resumo: 0.55, estrutura_filiais: 0.21 }),
      maxTools: 6,
      tetoDuro: 12,
    });
    expect(r.mantidas).toContain("estrutura_filiais");
    expect(r.teto).toBe(7); // 6 + a folga de 1 dependência
  });

  it("a folga NÃO deixa a dependência expulsar quem a puxou", () => {
    // Sem folga, entrar 1 dependência significaria cortar 1 ferramenta boa —
    // e a mais provável de sair seria justamente a de menor similaridade entre
    // as que respondem.
    const r = aplicarTetoTools({
      candidatas: ["a", "b", "c", "dep1", "dep2"],
      dependencias: ["dep1", "dep2"],
      similaridade: sim({ a: 0.9, b: 0.8, c: 0.7, dep1: 0.1, dep2: 0.1 }),
      maxTools: 3,
      tetoDuro: 12,
    });
    expect(r.mantidas.sort()).toEqual(["a", "b", "c", "dep1", "dep2"]);
    expect(r.cortadas).toEqual([]);
  });

  it("o TETO DURO impede a folga de reabrir o problema", () => {
    // Antes do corte, dependências somadas faziam "teto de 6" virar 27 — e aí a
    // lista de ferramentas custa mais que a resposta.
    const deps = Array.from({ length: 30 }, (_, i) => `dep${i}`);
    const r = aplicarTetoTools({
      candidatas: ["a", ...deps],
      dependencias: deps,
      similaridade: sim({ a: 0.9 }),
      maxTools: 6,
      tetoDuro: 12,
    });
    expect(r.mantidas).toHaveLength(12);
    expect(r.cortadas).toHaveLength(19);
  });

  it("forçada vence dependência, que vence similaridade", () => {
    const r = aplicarTetoTools({
      candidatas: ["forcada", "dep", "alta"],
      forcadas: ["forcada"],
      dependencias: ["dep"],
      similaridade: sim({ alta: 0.99, dep: 0.01, forcada: 0.0 }),
      maxTools: 1,
      tetoDuro: 12,
    });
    // teto = 1 + 1 dependência = 2: entram a forçada e a dependência.
    expect(r.mantidas).toEqual(["forcada", "dep"]);
    expect(r.cortadas).toEqual(["alta"]);
  });

  it("cabendo tudo, ninguém é cortado", () => {
    const r = aplicarTetoTools({ candidatas: ["a", "b"], maxTools: 6, tetoDuro: 12 });
    expect(r.cortadas).toEqual([]);
    expect(r.mantidas).toEqual(["a", "b"]);
  });

  it("empate é resolvido pelo NOME — seleção precisa ser reproduzível", () => {
    // Duas execuções iguais que escolhem ferramentas diferentes são impossíveis
    // de depurar por trace.
    const entrada = { candidatas: ["zebra", "abelha"], similaridade: sim({ zebra: 0.5, abelha: 0.5 }), maxTools: 1, tetoDuro: 12 };
    expect(aplicarTetoTools(entrada).mantidas).toEqual(["abelha"]);
    expect(aplicarTetoTools({ ...entrada, candidatas: ["abelha", "zebra"] }).mantidas).toEqual(["abelha"]);
  });

  it("entradas degeneradas não quebram", () => {
    expect(aplicarTetoTools({ candidatas: [], maxTools: 6, tetoDuro: 12 }).mantidas).toEqual([]);
    expect(aplicarTetoTools({ candidatas: ["a", "b"], maxTools: 0, tetoDuro: 12 }).mantidas).toHaveLength(1);
    // duplicatas não consomem duas vagas
    expect(aplicarTetoTools({ candidatas: ["a", "a", "b"], maxTools: 2, tetoDuro: 12 }).mantidas).toHaveLength(2);
  });
});
