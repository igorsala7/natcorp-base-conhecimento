import { describe, it, expect } from "vitest";
import { selecionarTopK, type ToolLite } from "./tool-narrow";

const T = (key: string, name: string, description = "", alwaysInclude = false): ToolLite => ({ key, name, description, alwaysInclude });

describe("selecionarTopK", () => {
  it("≤ max → mantém todas (sem estreitar)", () => {
    const tools = [T("a", "A"), T("b", "B"), T("c", "C")];
    const keep = selecionarTopK(tools, "qualquer coisa", 12);
    expect(keep).toEqual(new Set(["a", "b", "c"]));
  });

  it("acima de max com sinal → mantém as melhores por sobreposição de termos", () => {
    const tools = [
      T("consultar_ferias", "Consultar férias", "datas de férias do colaborador"),
      T("consultar_beneficios", "Consultar benefícios", "benefícios ativos do colaborador"),
      T("recibo_pagamento", "Recibo de pagamento", "holerite mensal"),
      T("espelho_ponto", "Espelho de ponto", "marcações do mês"),
    ];
    const keep = selecionarTopK(tools, "Quais são os meus benefícios?", 2);
    expect(keep.has("consultar_beneficios")).toBe(true);
    expect(keep.size).toBe(2);
  });

  it("sem sinal lexical → mantém TODAS (protege a assertividade)", () => {
    const tools = [T("x1", "Alfa"), T("x2", "Beta"), T("x3", "Gama"), T("x4", "Delta"), T("x5", "Épsilon")];
    const keep = selecionarTopK(tools, "zzz nada casa aqui", 2);
    expect(keep.size).toBe(5);
  });

  it("essenciais (alwaysInclude) são sempre mantidas, mesmo sem casar", () => {
    const tools = [
      T("ess", "Essencial", "", true),
      T("beneficios", "Consultar benefícios", "benefícios do colaborador"),
      T("ruido1", "Ruído um", "irrelevante"),
      T("ruido2", "Ruído dois", "irrelevante"),
    ];
    const keep = selecionarTopK(tools, "benefícios", 2);
    expect(keep.has("ess")).toBe(true);
    expect(keep.has("beneficios")).toBe(true);
  });

  it("sempreIncluir (ex.: tool forçada pelo escopo do widget) nunca é descartada", () => {
    const tools = [
      T("forcada", "Tool forçada", "sem relação com a pergunta"),
      T("beneficios", "Consultar benefícios", "benefícios do colaborador"),
      T("ruido1", "Ruído", "irrelevante"),
      T("ruido2", "Ruído", "irrelevante"),
    ];
    const keep = selecionarTopK(tools, "benefícios", 2, new Set(["forcada"]));
    expect(keep.has("forcada")).toBe(true);
    expect(keep.has("beneficios")).toBe(true);
  });
});
