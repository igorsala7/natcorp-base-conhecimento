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
