import { describe, it, expect } from "vitest";
import { semRemuneracao, campoDeRemuneracao } from "./remuneracao";

/** Nomes reais do retorno de `candidatos_selecionados` (natcorp, 12/08/2026). */
describe("campoDeRemuneracao", () => {
  it("pega os nomes que a ORDS usa hoje", () => {
    for (const c of [
      "salario", "total_remuneracao", "remuneracao_variavel", "perc_beneficio_variavel",
      "salario_pretendido", "salario_ultima", "tipo_salario",
    ]) expect(campoDeRemuneracao(c)).toBe(true);
  });

  it("não confisca campo que só descreve a vaga", () => {
    for (const c of ["cargo", "cod_vaga", "ccusto", "filial", "status_candidato", "data_requisicao"])
      expect(campoDeRemuneracao(c)).toBe(false);
  });
});

describe("semRemuneracao", () => {
  it("limpa a lista dentro de items, preservando o resto", () => {
    const r = semRemuneracao({ items: [{ cargo: "ANALISTA", salario: 5000, total_remuneracao: 6200 }] });
    expect(r).toEqual({ items: [{ cargo: "ANALISTA" }] });
  });

  it("alcança qualquer profundidade — o formato do payload varia", () => {
    const r = semRemuneracao([{ vaga: { cargo: "DEV", remuneracao_variavel: 1 } }]);
    expect(r).toEqual([{ vaga: { cargo: "DEV" } }]);
  });

  it("não quebra com nulo, texto ou número", () => {
    expect(semRemuneracao(null)).toBeNull();
    expect(semRemuneracao("ok")).toBe("ok");
    expect(semRemuneracao(42)).toBe(42);
  });
});
