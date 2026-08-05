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

describe("selecionarTopK — modo SEMÂNTICO (sim)", () => {
  it("piso RELATIVO corta a cauda de ruído, mesmo com poucas tools (≤ max)", () => {
    const tools = [T("t1", "Alpha"), T("t2", "Bravo"), T("t3", "Charlie"), T("t4", "Delta")];
    const sim = new Map([["t1", 0.75], ["t2", 0.72], ["t3", 0.58], ["t4", 0.55]]);
    // topo 0.75 → piso max(0.60, 0.67)=0.67 → só as duas próximas do topo (corta 0.58/0.55).
    const keep = selecionarTopK(tools, "zzz", 12, undefined, sim);
    expect(keep).toEqual(new Set(["t1", "t2"]));
  });

  it("resgate LEXICAL: termo exato no NOME entra mesmo com sim abaixo do piso", () => {
    const tools = [T("t1", "Alpha"), T("cnpj", "Consulta CNPJ")];
    const sim = new Map([["t1", 0.8], ["cnpj", 0.4]]);
    const keep = selecionarTopK(tools, "quero o cnpj da empresa", 12, undefined, sim);
    expect(keep.has("t1")).toBe(true); // por similaridade
    expect(keep.has("cnpj")).toBe(true); // resgatada pelo termo "cnpj" no nome
  });

  it("anti-INUNDAÇÃO: nada acima do piso → só o top-N por sim (não o módulo inteiro)", () => {
    const tools = [T("t1", "Alpha"), T("t2", "Bravo"), T("t3", "Charlie"), T("t4", "Delta"), T("t5", "Echo")];
    const sim = new Map([["t1", 0.55], ["t2", 0.52], ["t3", 0.5], ["t4", 0.48], ["t5", 0.45]]);
    const keep = selecionarTopK(tools, "zzz", 12, undefined, sim);
    expect(keep).toEqual(new Set(["t1", "t2", "t3"])); // ANTIFLOOD_N = 3
  });

  it("forçadas (alwaysInclude) entram sempre, mesmo com sim baixíssimo", () => {
    const tools = [T("t1", "Alpha"), T("ess", "Essencial", "", true)];
    const sim = new Map([["t1", 0.9], ["ess", 0.1]]);
    const keep = selecionarTopK(tools, "zzz", 12, undefined, sim);
    expect(keep.has("ess")).toBe(true);
    expect(keep.has("t1")).toBe(true);
  });

  it("sem sim para estas tools (Map não cobre) → cai no modo LÉXICO", () => {
    const tools = [T("a", "A"), T("b", "B"), T("c", "C")];
    const sim = new Map([["outra", 0.9]]); // topSim 0 nas tools → fallback lexical
    const keep = selecionarTopK(tools, "qualquer", 12, undefined, sim);
    expect(keep).toEqual(new Set(["a", "b", "c"])); // ≤ max no lexical → todas
  });
});
