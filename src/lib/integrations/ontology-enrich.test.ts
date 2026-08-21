import { describe, it, expect } from "vitest";
import { selecionarFormasOntologia } from "./ontology-enrich";
import type { EntradaOntologia } from "@/lib/ai/ontology";

/**
 * Regressão do ruído que apareceu ao enriquecer o vetor da ferramenta com a
 * ontologia do cliente: o alias "SO" (de "Jornada Sobreaviso") casava dentro do
 * texto de `atualizar_telefone` e colava 11 formas de sobreaviso numa ferramenta
 * de trocar celular — que virou a 1ª colocada para "Jornada Sobreaviso".
 *
 * Duas travas, e as duas precisam continuar valendo:
 *   · gatilho com menos de 4 caracteres nunca dispara conceito;
 *   · gatilho presente em boa parte do catálogo (genérico) não sustenta conceito.
 */
const E = (forms: string[], matchNorms: string[]): EntradaOntologia => ({ forms, matchNorms });

const SOBREAVISO = E(
  ["Jornada Sobreaviso", "sobreavisos", "horas de sobreaviso", "escala de sobreaviso"],
  ["so", "sobreaviso", "jornada sobreaviso"],
);
const FERIAS = E(["Programação de Férias", "Agendar férias", "marcar ferias"], ["ferias", "programacao de ferias"]);
const COLABORADOR = E(["Dados Funcionários", "empregado", "ficha do funcionário"], ["colaborador", "dados colaborador"]);

describe("selecionarFormasOntologia", () => {
  it('gatilho curto ("SO") NÃO arrasta o conceito inteiro', () => {
    const textos = new Map([["telefone", "Atualizar telefone — Atualiza o telefone celular pessoal do colaborador. Número só com DDD."]]);
    const formas = selecionarFormasOntologia(textos, [SOBREAVISO]);
    expect(formas.get("telefone")).toEqual([]);
  });

  it("gatilho específico traz as formas do conceito", () => {
    const textos = new Map([["ferias", "Consultar férias — períodos de férias do colaborador (aquisitivo, gozo, saldo)."]]);
    const formas = selecionarFormasOntologia(textos, [FERIAS]);
    expect(formas.get("ferias")).toContain("Agendar férias");
    expect(formas.get("ferias")).toContain("marcar ferias");
  });

  it("gatilho GENÉRICO (em quase todo o catálogo) não sustenta o conceito", () => {
    // "colaborador" aparece nas 5 ferramentas → acima do teto de 20%.
    const textos = new Map(
      ["t1", "t2", "t3", "t4", "t5"].map((k) => [k, `Ferramenta ${k} — dados do colaborador na empresa.`] as const),
    );
    const formas = selecionarFormasOntologia(textos, [COLABORADOR]);
    for (const k of textos.keys()) expect(formas.get(k)).toEqual([]);
  });

  it("o mesmo conceito ENTRA quando o gatilho é raro no catálogo", () => {
    const textos = new Map([
      ["t1", "Dados do colaborador na empresa."],
      ["t2", "Espelho de ponto."],
      ["t3", "Recibo de pagamento."],
      ["t4", "Requisição de vaga."],
      ["t5", "Exames periódicos."],
    ]);
    const formas = selecionarFormasOntologia(textos, [COLABORADOR]);
    expect(formas.get("t1")).toContain("Dados Funcionários");
    expect(formas.get("t2")).toEqual([]);
  });

  it("respeita o teto de formas por ferramenta", () => {
    const muitas = E(Array.from({ length: 50 }, (_, i) => `forma ${i}`), ["conceito raro"]);
    const textos = new Map([["t1", "texto com conceito raro dentro"]]);
    expect(selecionarFormasOntologia(textos, [muitas], { max: 10 }).get("t1")).toHaveLength(10);
  });

  it("sem ontologia, ninguém recebe forma nenhuma (o vetor global segue valendo)", () => {
    const textos = new Map([["t1", "qualquer coisa"]]);
    expect(selecionarFormasOntologia(textos, []).get("t1")).toEqual([]);
  });

  it("não repete forma vinda de conceitos diferentes", () => {
    const a = E(["Férias"], ["conceito alfa"]);
    const b = E(["Férias"], ["conceito beta"]);
    const textos = new Map([["t1", "texto com conceito alfa e conceito beta"]]);
    expect(selecionarFormasOntologia(textos, [a, b]).get("t1")).toEqual(["Férias"]);
  });
});

describe("ordem das formas — o corte em `max` precisa levar as certas", () => {
  it("gatilho RARO no catálogo entra antes do comum", () => {
    // Medido em 20/08/2026: 248 formas casadas por ferramenta em média, teto de
    // 40, e 84% descartado por ORDEM DE CHEGADA. Com a decisão entre a 1ª e a 2ª
    // ferramenta acontecendo num gap mediano de 0,020 de similaridade, quais
    // sinônimos entram no vetor decidia a escolha — e era sorteio.
    const textos = new Map([
      ["alvo", "consulta de sobreaviso e dados do colaborador"],
      ["outra1", "dados do colaborador"],
      ["outra2", "dados do colaborador"],
      ["outra3", "dados do colaborador"],
      ["outra4", "dados do colaborador"],
    ]);
    const entradas: EntradaOntologia[] = [
      // "colaborador" está em 5 de 5 ferramentas: não distingue nada.
      { matchNorms: ["colaborador"], forms: ["Colaborador", "funcionário", "empregado"] },
      // "sobreaviso" está em 1 de 5: identifica ESTA ferramenta.
      { matchNorms: ["sobreaviso"], forms: ["Sobreaviso", "plantão"] },
    ];
    // `max: 2` força o corte a escolher — é exatamente a situação real.
    const r = selecionarFormasOntologia(textos, entradas, { max: 2, tetoFrequencia: 0.5 });
    expect(r.get("alvo")).toEqual(["Sobreaviso", "plantão"]);
  });

  it("a ordem não depende de como a ontologia chegou do banco", () => {
    // Reindexar a mesma ferramenta tem de produzir o mesmo vetor.
    const textos = new Map([["t", "ferias e ponto eletronico"]]);
    const a: EntradaOntologia[] = [
      { matchNorms: ["ferias"], forms: ["Férias"] },
      { matchNorms: ["ponto"], forms: ["Ponto"] },
    ];
    const b: EntradaOntologia[] = [...a].reverse();
    expect(selecionarFormasOntologia(textos, a).get("t")).toEqual(
      selecionarFormasOntologia(textos, b).get("t"),
    );
  });
});
