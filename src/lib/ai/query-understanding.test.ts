import { describe, it, expect } from "vitest";
import { limparConsulta } from "./query-clean";
import { palavrasSignificativas, termoRelacionado } from "./ontology";

describe("limparConsulta", () => {
  it("mantém uma consulta limpa", () => {
    expect(limparConsulta("solicitar férias", "orig")).toBe("solicitar férias");
  });
  it("remove aspas, rótulos e cercas de código", () => {
    expect(limparConsulta('"solicitar férias"', "o")).toBe("solicitar férias");
    expect(limparConsulta("Consulta: registro de ponto", "o")).toBe("registro de ponto");
    expect(limparConsulta("```\nabrir chamado\n```", "o")).toBe("abrir chamado");
  });
  it("pega só a primeira linha (descarta explicação do modelo)", () => {
    expect(limparConsulta("cancelar requisição de férias\n(reformulei…)", "o")).toBe(
      "cancelar requisição de férias",
    );
  });
  it("degrada para a original quando vem vazio ou gigante", () => {
    expect(limparConsulta("", "pergunta original")).toBe("pergunta original");
    expect(limparConsulta("x".repeat(400), "orig")).toBe("orig");
  });
});

describe("palavrasSignificativas", () => {
  it("tira stopwords e palavras curtas, normaliza acento", () => {
    expect(palavrasSignificativas("Como faço para tirar férias?")).toEqual(["tirar", "ferias"]);
  });
});

describe("termoRelacionado", () => {
  it("casa por pedaço de palavra (coloquial/parcial)", () => {
    expect(termoRelacionado("programacao de ferias", ["ferias"])).toBe(true);
    expect(termoRelacionado("chamado interno", ["chamados"])).toBe(true); // chamado ⊂ chamados
    expect(termoRelacionado("nota fiscal", ["ferias"])).toBe(false);
  });
});
