import { describe, it, expect } from "vitest";
import { publicoDaAbertura, montarAbertura, escolherPerguntas, LIMITE_PERGUNTAS } from "./abertura";

describe("publicoDaAbertura", () => {
  it("PO e PG saem direto do painel", () => {
    expect(publicoDaAbertura({ painel: "PO" })).toBe("operador");
    expect(publicoDaAbertura({ painel: "PG" })).toBe("gestor");
  });

  it("painel manda mesmo sem identidade — gestor sem matrícula continua gestor", () => {
    // Rebaixar para anônimo por causa de um campo ausente daria a ele a
    // abertura errada, que é justamente o problema que estamos consertando.
    expect(publicoDaAbertura({ painel: "PG", matricula: null, codCandidato: null })).toBe("gestor");
  });

  it("PC se divide pela identidade: matrícula é colaborador", () => {
    expect(publicoDaAbertura({ painel: "PC", matricula: "365785" })).toBe("colaborador");
  });

  it("PC sem matrícula e com código de candidato é candidato", () => {
    expect(publicoDaAbertura({ painel: "PC", codCandidato: "C-91" })).toBe("candidato");
  });

  it("matrícula vence código de candidato — recém-contratado deixa de ser candidato", () => {
    // A ordem é regra de produto e vive em tipoDeAcesso; aqui só confirmamos
    // que a abertura não a contradiz.
    expect(publicoDaAbertura({ painel: "PC", matricula: "365785", codCandidato: "C-91" })).toBe(
      "colaborador",
    );
  });

  it("PC sem identidade nenhuma é anônimo", () => {
    expect(publicoDaAbertura({ painel: "PC" })).toBe("anonimo");
  });

  it("aceita painel em minúscula e com espaço — o token vem do anfitrião", () => {
    expect(publicoDaAbertura({ painel: " pg " })).toBe("gestor");
  });

  it("sem painel, ou painel desconhecido, cai em anônimo", () => {
    expect(publicoDaAbertura({})).toBe("anonimo");
    expect(publicoDaAbertura({ painel: "XX", matricula: "365785" })).toBe("anonimo");
  });
});

describe("montarAbertura", () => {
  it("a saudação muda com o público e não fala mais em documentação", () => {
    expect(montarAbertura({ publico: "gestor" }).welcome).toMatch(/equipe/i);
    expect(montarAbertura({ publico: "candidato" }).welcome).toMatch(/candidatura/i);
  });

  it("sugestões cadastradas na chave vencem — alguém as escolheu a dedo", () => {
    const a = montarAbertura({ publico: "gestor", configuradas: ["Quem está de férias"] });
    expect(a.suggestions).toEqual(["Quem está de férias"]);
  });

  it("descarta lixo no que veio cadastrado", () => {
    const a = montarAbertura({ publico: "gestor", configuradas: ["  ", 42, null, "Vale"] });
    expect(a.suggestions).toEqual(["Vale"]);
  });

  it("respeita o teto mesmo se a chave cadastrar mais", () => {
    const muitas = ["a", "b", "c", "d", "e"];
    expect(montarAbertura({ publico: "gestor", configuradas: muitas }).suggestions).toHaveLength(
      LIMITE_PERGUNTAS,
    );
  });

  it("config não-lista é ignorada sem quebrar", () => {
    expect(montarAbertura({ publico: "operador", configuradas: "isso não é lista" }).suggestions)
      .toEqual([]);
  });

  it("sem config na chave, cai na curadoria do público", () => {
    expect(montarAbertura({ publico: "gestor" }).suggestions).toHaveLength(3);
  });
});

describe("escolherPerguntas", () => {
  const ctx = { publico: "gestor" as const, limite: LIMITE_PERGUNTAS };

  it("gestor pergunta da própria equipe, em língua de gestor", () => {
    const qs = escolherPerguntas(ctx);
    expect(qs).toHaveLength(3);
    // A regra que justifica a abertura inteira: nada de jargão de RH. Se um dia
    // alguém trocar "quem está de férias" por "afastamentos por código", o
    // atalho para de servir para quem ele foi feito.
    expect(qs.join(" ")).toMatch(/equipe/i);
    expect(qs.join(" ")).not.toMatch(/afastamento|admiss|rescis|adm\/dem/i);
  });

  it("colaborador pergunta de si; candidato, da candidatura", () => {
    expect(escolherPerguntas({ publico: "colaborador", limite: 3 }).join(" ")).toMatch(/me[u]|férias/i);
    expect(escolherPerguntas({ publico: "candidato", limite: 3 }).join(" ")).toMatch(/candidatura|vaga/i);
  });

  it("operador não recebe atalho — quem é do RH digita mais rápido do que lê chip", () => {
    expect(escolherPerguntas({ publico: "operador", limite: 3 })).toEqual([]);
  });

  it("anônimo não recebe atalho — sem escopo, todo atalho terminaria em recusa", () => {
    expect(escolherPerguntas({ publico: "anonimo", limite: 3 })).toEqual([]);
  });

  it("respeita o limite", () => {
    expect(escolherPerguntas({ ...ctx, limite: 2 })).toHaveLength(2);
    expect(escolherPerguntas({ ...ctx, limite: 0 })).toEqual([]);
  });

  it("podeResponder corta o que a base não responde — sugerir e recusar é pior que não sugerir", () => {
    const qs = escolherPerguntas({ ...ctx, podeResponder: (c) => c !== "equipe_ferias" });
    expect(qs).toHaveLength(2);
    expect(qs.join(" ")).not.toMatch(/férias/i);
  });

  it("base que não responde nada devolve lista vazia, sem quebrar", () => {
    expect(escolherPerguntas({ ...ctx, podeResponder: () => false })).toEqual([]);
  });

  it("o filtro chega através do montarAbertura", () => {
    const a = montarAbertura({ publico: "gestor", podeResponder: (c) => c === "equipe_headcount" });
    expect(a.suggestions).toHaveLength(1);
  });
});
