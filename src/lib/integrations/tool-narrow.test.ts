import { describe, it, expect } from "vitest";
import { selecionarTopK, selecionarPorFaceta, aplicarDesempate, dependenciasCitadas, forcaLexical, type CorteDesempate, type RegraDesempate, type ToolLite } from "./tool-narrow";

const T = (key: string, name: string, description = "", alwaysInclude = false): ToolLite => ({ key, name, description, alwaysInclude });
/** Tool com desempate numérico (prioridade + grupo de ambiguidade). */
const TG = (key: string, grupo: string, prioridade: number): ToolLite => ({
  key,
  name: key,
  description: "",
  alwaysInclude: false,
  grupo,
  prioridade,
});
const regra = (vencedora: string, perdedora: string, modo: "empate" | "sempre" = "empate"): RegraDesempate => ({
  vencedora,
  perdedora,
  modo,
});

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

  /**
   * ANTES: nada passava o piso absoluto (0.60) e o anti-inundação entregava as 3
   * melhores por ordenação CEGA — inclusive uma a 0.50, longe do topo, como se fosse
   * relevante. AGORA o piso acompanha a distribuição: topo 0.55 → piso 0.506, então
   * passam as que estão de fato PERTO do topo (0.55 e 0.52) e não um número fixo.
   * Foi o que quebrou quando 36% do catálogo saiu do ar e o topo despencou.
   */
  it("turno FRACO: passa quem está perto do topo, não um top-N fixo", () => {
    const tools = [T("t1", "Alpha"), T("t2", "Bravo"), T("t3", "Charlie"), T("t4", "Delta"), T("t5", "Echo")];
    const sim = new Map([["t1", 0.55], ["t2", 0.52], ["t3", 0.5], ["t4", 0.48], ["t5", 0.45]]);
    const keep = selecionarTopK(tools, "zzz", 12, undefined, sim);
    expect(keep).toEqual(new Set(["t1", "t2"]));
  });

  it("turno fraco avisa que é fraco (o modelo precisa saber)", () => {
    const tools = [T("t1", "Alpha"), T("t2", "Bravo")];
    const sim = new Map([["t1", 0.55], ["t2", 0.52]]);
    let info: { topSim: number; fraco: boolean; adaptativo: boolean } | null = null;
    selecionarTopK(tools, "zzz", 12, undefined, sim, false, { onSelecao: (i) => { info = i; } });
    expect(info).not.toBeNull();
    expect(info!.fraco).toBe(true);
    expect(info!.adaptativo).toBe(true);
  });

  /**
   * O RANKING É O DIAGNÓSTICO — e ele só serve se trouxer quem foi CORTADO.
   *
   * As ofertadas o trace já sabia (`keys`). O que faltava é a posição e a nota
   * de quem ficou de fora: é a diferença entre "a certa veio em 2º" (conserta
   * com desempate) e "a certa veio em 40º" (conserta com embedding). Um
   * ranking só das ofertadas não responderia nem uma nem outra.
   */
  it("ranking registra as CORTADAS, não só as ofertadas", () => {
    const tools = [T("t1", "Alpha"), T("t2", "Bravo"), T("t3", "Charlie"), T("t4", "Delta")];
    const sim = new Map([["t1", 0.8], ["t2", 0.75], ["t3", 0.4], ["t4", 0.2]]);
    let rank: [string, number][] | null = null;
    const keep = selecionarTopK(tools, "zzz", 12, undefined, sim, false, { onRanking: (r) => { rank = r; } });
    // O piso corta t3 e t4 — elas NÃO vão ao modelo…
    expect(keep).toEqual(new Set(["t1", "t2"]));
    // …mas VÃO ao ranking, com a nota, que é o ponto do campo.
    expect(rank).toEqual([["t1", 0.8], ["t2", 0.75], ["t3", 0.4], ["t4", 0.2]]);
  });

  it("ranking sai em ordem decrescente de nota", () => {
    const tools = [T("baixa", "Baixa"), T("alta", "Alta"), T("media", "Media")];
    const sim = new Map([["baixa", 0.3], ["alta", 0.9], ["media", 0.6]]);
    let rank: [string, number][] | null = null;
    selecionarTopK(tools, "zzz", 12, undefined, sim, false, { onRanking: (r) => { rank = r; } });
    expect(rank!.map(([k]) => k)).toEqual(["alta", "media", "baixa"]);
  });

  /**
   * As `always_include` entram no turno de qualquer jeito e com similaridade de
   * ruído (0.46–0.62 medido). Se ocupassem vagas do teto de 20, empurrariam
   * para fora justamente a ferramenta cuja posição se quer descobrir.
   */
  it("ranking IGNORA as sempre-incluídas — elas não competem por vaga", () => {
    const tools = [T("essencial", "Essencial", "", true), T("pedida", "Pedida")];
    const sim = new Map([["essencial", 0.55], ["pedida", 0.9]]);
    let rank: [string, number][] | null = null;
    let info: { keys: string[] } | null = null;
    selecionarTopK(tools, "zzz", 12, undefined, sim, false, { onSelecao: (i) => { info = i; }, onRanking: (r) => { rank = r; } });
    expect(info!.keys).toContain("essencial"); // foi ao modelo…
    expect(rank!.map(([k]) => k)).toEqual(["pedida"]); // …mas não ao ranking
  });

  /**
   * O CAMINHO MULTI-FACETA É 15% DO TRÁFEGO — e é o caso difícil.
   *
   * Ele sai de `selecionarTopK` por um `return` próprio, sem passar pelo
   * `onSelecao`. Se o ranking dependesse daquele callback, a pergunta de várias
   * intenções — justamente a que mais erra — seguiria sem diagnóstico nenhum.
   */
  it("ranking também sai no caminho MULTI-FACETA, que não chama onSelecao", () => {
    const tools = [T("a", "Alpha"), T("b", "Bravo"), T("c", "Charlie")];
    const sim = new Map([["a", 0.8], ["b", 0.7], ["c", 0.3]]);
    const facetas = [new Map([["a", 0.8]]), new Map([["b", 0.7]])];
    let rank: [string, number][] | null = null;
    let info: unknown = null;
    selecionarTopK(tools, "zzz", 12, undefined, sim, false, { onSelecao: (i) => { info = i; }, onRanking: (r) => { rank = r; } }, facetas);
    expect(info).toBeNull(); // confirma que este caminho realmente não reporta seleção
    expect(rank).toEqual([["a", 0.8], ["b", 0.7], ["c", 0.3]]);
  });

  it("sem similaridade (modo lexical) não inventa ranking", () => {
    let rank: [string, number][] | null = null;
    selecionarTopK([T("a", "Alpha"), T("b", "Bravo")], "alpha", 1, undefined, null, false, { onRanking: (r) => { rank = r; } });
    expect(rank).toBeNull();
  });

  it("turno SAUDÁVEL não muda nada — prova de não-regressão do piso adaptativo", () => {
    const tools = [T("t1", "Alpha"), T("t2", "Bravo"), T("t3", "Charlie")];
    const sim = new Map([["t1", 0.75], ["t2", 0.68], ["t3", 0.61]]);
    let info: { fraco: boolean; adaptativo: boolean; piso: number } | null = null;
    const keep = selecionarTopK(tools, "zzz", 12, undefined, sim, false, { onSelecao: (i) => { info = i; } });
    // piso = max(min(0.60, 0.69), 0.67) = 0.67 — idêntico ao de antes.
    expect(info!.piso).toBeCloseTo(0.67, 5);
    expect(info!.adaptativo).toBe(false);
    expect(info!.fraco).toBe(false);
    expect(keep).toEqual(new Set(["t1", "t2"]));
  });

  it("essenciais NÃO consomem a cota (mesma regra do caminho multi-faceta)", () => {
    const forcadas = ["e1", "e2", "e3", "e4", "e5"].map((k) => T(k, k.toUpperCase(), "", true));
    const outras = Array.from({ length: 20 }, (_, i) => T(`t${i}`, `Tool ${i}`));
    const sim = new Map<string, number>();
    forcadas.forEach((t) => sim.set(t.key, 0.5));
    outras.forEach((t, i) => sim.set(t.key, 0.9 - i * 0.005));
    const keep = selecionarTopK([...forcadas, ...outras], "zzz", 12, undefined, sim);
    expect(keep.size).toBe(17); // 5 essenciais + 12 vagas reais (antes: 12 no total)
    for (const t of forcadas) expect(keep.has(t.key)).toBe(true);
    for (let i = 0; i < 12; i++) expect(keep.has(`t${i}`), `t${i}`).toBe(true);
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

  it("relax (COMPOSTO): afrouxa o piso e mantém a co-intenção de menor sim", () => {
    const tools = [T("t1", "Alpha"), T("t2", "Bravo"), T("t3", "Charlie")];
    const sim = new Map([["t1", 0.75], ["t2", 0.72], ["t3", 0.62]]);
    // ESTRITO: piso max(0.60, 0.67)=0.67 → corta t3 (0.62)
    expect(selecionarTopK(tools, "zzz", 12, undefined, sim, false)).toEqual(new Set(["t1", "t2"]));
    // RELAX: piso max(0.55, 0.59)=0.59 → mantém as três
    expect(selecionarTopK(tools, "zzz", 12, undefined, sim, true)).toEqual(new Set(["t1", "t2", "t3"]));
  });
});

// Números reais medidos no catálogo natcorp para o par histórico financeiro.
const HF = "historico_financeiro";
const BI = "bi_historico_financeiro";

describe("aplicarDesempate — pareado (nível 1)", () => {
  const par = [TG(HF, "hist_financeiro", 0), TG(BI, "hist_financeiro", 0)];
  const nunca = () => false;

  it("quase-empate NO TOPO → corta a perdedora e explica o corte", () => {
    // "meu histórico financeiro": 0.766 × 0.731 (ambas na faixa de 0.05 do topo)
    const sim = new Map([[HF, 0.766], [BI, 0.731]]);
    const { manter, cortes } = aplicarDesempate(par, (t) => sim.get(t.key) ?? 0, [regra(HF, BI)], nunca);
    expect(manter.map((t) => t.key)).toEqual([HF]);
    expect(cortes).toEqual<CorteDesempate[]>([{ perdedora: BI, vencedora: HF, via: "pareado", modo: "empate" }]);
  });

  it("nenhuma das duas disputa o topo → NÃO corta (a pergunta agregada continua inteira)", () => {
    // "total gasto por filial": o topo é outra tool (0.680); estas ficam em 0.625/0.629.
    const tools = [TG("bi_agrupado", "", 0), ...par];
    const sim = new Map([["bi_agrupado", 0.68], [HF, 0.625], [BI, 0.629]]);
    const { manter, cortes } = aplicarDesempate(tools, (t) => sim.get(t.key) ?? 0, [regra(HF, BI)], nunca);
    expect(manter.map((t) => t.key)).toEqual(["bi_agrupado", HF, BI]);
    expect(cortes).toEqual([]);
  });

  it("modo 'sempre' corta mesmo fora da faixa de disputa", () => {
    const sim = new Map([[HF, 0.62], [BI, 0.40]]);
    const { manter } = aplicarDesempate(par, (t) => sim.get(t.key) ?? 0, [regra(HF, BI, "sempre")], nunca);
    expect(manter.map((t) => t.key)).toEqual([HF]);
  });

  it("sem a vencedora no turno, a regra não tira ninguém", () => {
    const sim = new Map([[BI, 0.7]]);
    const { manter } = aplicarDesempate([TG(BI, "hist_financeiro", 0)], (t) => sim.get(t.key) ?? 0, [regra(HF, BI)], nunca);
    expect(manter.map((t) => t.key)).toEqual([BI]);
  });

  it("forçada/essencial é IMUNE ao corte", () => {
    const sim = new Map([[HF, 0.766], [BI, 0.731]]);
    const { manter, cortes } = aplicarDesempate(par, (t) => sim.get(t.key) ?? 0, [regra(HF, BI, "sempre")], (t) => t.key === BI);
    expect(manter.map((t) => t.key)).toEqual([HF, BI]);
    expect(cortes).toEqual([]);
  });

  it("cadeia A>B>C com os três no turno → sobra o A", () => {
    const tools = [TG("a", "", 0), TG("b", "", 0), TG("c", "", 0)];
    const sim = new Map([["a", 0.8], ["b", 0.79], ["c", 0.78]]);
    const { manter } = aplicarDesempate(tools, (t) => sim.get(t.key) ?? 0, [regra("a", "b"), regra("b", "c")], nunca);
    expect(manter.map((t) => t.key)).toEqual(["a"]);
  });

  it("regra sem a vencedora presente não dispara: sem B, o C fica", () => {
    const tools = [TG("a", "", 0), TG("c", "", 0)];
    const sim = new Map([["a", 0.8], ["c", 0.78]]);
    const { manter } = aplicarDesempate(tools, (t) => sim.get(t.key) ?? 0, [regra("a", "b"), regra("b", "c")], nunca);
    expect(manter.map((t) => t.key)).toEqual(["a", "c"]);
  });

  it("ciclo indireto (A>B>C>A) esvaziaria o turno → os cortes são descartados", () => {
    const tools = [TG("a", "", 0), TG("b", "", 0), TG("c", "", 0)];
    const sim = new Map([["a", 0.8], ["b", 0.79], ["c", 0.78]]);
    const { manter, cortes } = aplicarDesempate(
      tools,
      (t) => sim.get(t.key) ?? 0,
      [regra("a", "b"), regra("b", "c"), regra("c", "a")],
      nunca,
    );
    expect(manter).toHaveLength(3);
    expect(cortes).toEqual([]);
  });

  it("modo lexical (sem similaridade): só as regras 'sempre' valem", () => {
    const { manter: comEmpate } = aplicarDesempate(par, null, [regra(HF, BI, "empate")], nunca);
    expect(comEmpate.map((t) => t.key)).toEqual([HF, BI]);
    const { manter: comSempre } = aplicarDesempate(par, null, [regra(HF, BI, "sempre")], nunca);
    expect(comSempre.map((t) => t.key)).toEqual([HF]);
  });
});

describe("aplicarDesempate — prioridade por grupo (nível 2)", () => {
  const nunca = () => false;

  it("maior prioridade do MESMO grupo vence o quase-empate", () => {
    const tools = [TG(HF, "hist_financeiro", 1), TG(BI, "hist_financeiro", 0)];
    const sim = new Map([[HF, 0.766], [BI, 0.731]]);
    const { manter, cortes } = aplicarDesempate(tools, (t) => sim.get(t.key) ?? 0, [], nunca);
    expect(manter.map((t) => t.key)).toEqual([HF]);
    expect(cortes[0]).toMatchObject({ perdedora: BI, vencedora: HF, via: "grupo" });
  });

  it("prioridade alta NÃO atropela tool de outro grupo", () => {
    const tools = [TG(HF, "hist_financeiro", 9), TG("consultar_ferias", "ferias", 0)];
    const sim = new Map([[HF, 0.75], ["consultar_ferias", 0.74]]);
    const { manter } = aplicarDesempate(tools, (t) => sim.get(t.key) ?? 0, [], nunca);
    expect(manter.map((t) => t.key)).toEqual([HF, "consultar_ferias"]);
  });

  it("sem grupo, a prioridade não faz nada", () => {
    const tools = [{ ...TG(HF, "", 9), grupo: null }, { ...TG(BI, "", 0), grupo: null }];
    const sim = new Map([[HF, 0.75], [BI, 0.74]]);
    const { manter } = aplicarDesempate(tools, (t) => sim.get(t.key) ?? 0, [], nunca);
    expect(manter).toHaveLength(2);
  });

  it("mesma prioridade → ninguém cai (empate real vira desambiguação, não chute)", () => {
    const tools = [TG(HF, "hist_financeiro", 2), TG(BI, "hist_financeiro", 2)];
    const sim = new Map([[HF, 0.75], [BI, 0.74]]);
    const { manter } = aplicarDesempate(tools, (t) => sim.get(t.key) ?? 0, [], nunca);
    expect(manter).toHaveLength(2);
  });

  it("o PAREADO vence o numérico quando os dois apontam para lados opostos", () => {
    const tools = [TG(HF, "hist_financeiro", 0), TG(BI, "hist_financeiro", 5)];
    const sim = new Map([[HF, 0.766], [BI, 0.731]]);
    const { manter, cortes } = aplicarDesempate(tools, (t) => sim.get(t.key) ?? 0, [regra(HF, BI)], nunca);
    expect(manter.map((t) => t.key)).toEqual([HF]);
    expect(cortes[0]?.via).toBe("pareado");
  });
});

describe("selecionarPorFaceta / selecionarTopK — multi-intenção", () => {
  // Similaridades REAIS medidas no catálogo natcorp (05/08/2026) para a pergunta de
  // 7 intenções que devolveu "não existe ferramenta" para 4 delas.
  const TOOLS = [
    T("estrutura_centros_custo", "Estrutura: centros de custo"),
    T("bi_headcount", "BI headcount"),
    T("pagamento_colaboradores", "Pagamento: colaboradores"),
    T("bi_avaliacoes", "BI avaliações"),
    T("linha_tempo", "Linha do tempo"),
    T("consultar_ferias", "Consultar férias"),
    T("historico_financeiro_meses", "Histórico financeiro: meses"),
    T("bi_dados_cadastrais", "BI dados cadastrais"),
    T("frequencia_escala_equipe", "Frequência: escala da equipe"),
    T("ess1", "Essencial 1", "", true),
    T("ess2", "Essencial 2", "", true),
    T("ess3", "Essencial 3", "", true),
    T("ess4", "Essencial 4", "", true),
    T("ess5", "Essencial 5", "", true),
  ];
  // A pergunta INTEIRA: as 4 que faltaram ficam abaixo do piso (topo 0.73 − 0.08 = 0.65).
  const simInteira = new Map([
    ["estrutura_centros_custo", 0.73], ["bi_headcount", 0.712], ["bi_dados_cadastrais", 0.697],
    ["frequencia_escala_equipe", 0.702], ["pagamento_colaboradores", 0.665],
    ["bi_avaliacoes", 0.625], ["consultar_ferias", 0.628], ["linha_tempo", 0.616], ["historico_financeiro_meses", 0.601],
  ]);
  // Cada faceta, medida sozinha — a mesma ferramenta vira 1º lugar.
  const simAvaliacoes = new Map([["bi_avaliacoes", 0.769], ["bi_dados_cadastrais", 0.60], ["bi_headcount", 0.55]]);
  const simCargos = new Map([["linha_tempo", 0.689], ["bi_dados_cadastrais", 0.677], ["bi_headcount", 0.56]]);
  const simFerias = new Map([["consultar_ferias", 0.702], ["bi_headcount", 0.58], ["linha_tempo", 0.55]]);
  const simHoras = new Map([["historico_financeiro_meses", 0.59], ["bi_headcount", 0.54], ["pagamento_colaboradores", 0.52]]);

  it("o ranking ÚNICO perde as 4 intenções secundárias (regressão do caso real)", () => {
    const keep = selecionarTopK(TOOLS, "…", 12, undefined, simInteira);
    expect(keep.has("bi_avaliacoes")).toBe(false);
    expect(keep.has("linha_tempo")).toBe(false);
    expect(keep.has("consultar_ferias")).toBe(false);
    expect(keep.has("historico_financeiro_meses")).toBe(false);
  });

  it("multi-faceta traz as quatro de volta", () => {
    const keep = selecionarTopK(TOOLS, "…", 18, undefined, simInteira, false, undefined, [
      simInteira, simAvaliacoes, simCargos, simFerias, simHoras,
    ]);
    expect(keep.has("bi_avaliacoes")).toBe(true);
    expect(keep.has("linha_tempo")).toBe(true);
    expect(keep.has("consultar_ferias")).toBe(true);
    expect(keep.has("historico_financeiro_meses")).toBe(true);
  });

  it("a faceta FRACA (topo 0.59, abaixo do piso absoluto de 0.60) ainda leva ferramenta", () => {
    const escolhidas = selecionarPorFaceta(TOOLS, [simHoras]).map((t) => t.key);
    expect(escolhidas[0]).toBe("historico_financeiro_meses");
  });

  it("essenciais entram FORA da cota (não comem as vagas das intenções)", () => {
    const keep = selecionarTopK(TOOLS, "…", 4, undefined, simInteira, false, undefined, [simAvaliacoes, simFerias]);
    for (const e of ["ess1", "ess2", "ess3", "ess4", "ess5"]) expect(keep.has(e)).toBe(true);
    expect(keep.has("bi_avaliacoes")).toBe(true);
    expect(keep.has("consultar_ferias")).toBe(true);
  });

  it("RODÍZIO: com o teto apertado, cada faceta leva a sua 1ª antes de alguém levar a 2ª", () => {
    const escolhidas = selecionarPorFaceta(TOOLS, [simAvaliacoes, simFerias]).slice(0, 2).map((t) => t.key);
    expect(escolhidas).toEqual(["bi_avaliacoes", "consultar_ferias"]);
  });

  it("uma faceta só (pergunta simples) → caminho normal, nada muda", () => {
    const comUma = selecionarTopK(TOOLS, "…", 12, undefined, simInteira, false, undefined, [simInteira]);
    const semNada = selecionarTopK(TOOLS, "…", 12, undefined, simInteira);
    expect(comUma).toEqual(semNada);
  });

  it("facetas sem embedding (provedor frio) → cai no ranking único, sem quebrar", () => {
    const keep = selecionarTopK(TOOLS, "…", 12, undefined, simInteira, false, undefined, [new Map(), new Map()]);
    expect(keep.has("estrutura_centros_custo")).toBe(true);
  });
});

describe("dependenciasCitadas", () => {
  const TODAS = [
    T("linha_tempo", "Linha do tempo", "DEPENDÊNCIA OBRIGATÓRIA: chame `linha_tempo_fato` ANTES para descobrir o fato."),
    T("linha_tempo_fato", "Tipos de fato", "Lista os TIPOS de fato da linha do tempo."),
    T("historico_financeiro", "Histórico financeiro", "Se não indicou o mês, liste com historico_financeiro_meses antes."),
    T("historico_financeiro_meses", "Meses disponíveis", "Lista os meses do histórico financeiro."),
    T("consultar_ferias", "Férias", "Férias do colaborador."),
  ];

  it("puxa a ferramenta citada na descrição da selecionada", () => {
    const deps = dependenciasCitadas([TODAS[0]!], TODAS);
    expect(deps).toEqual([{ key: "linha_tempo_fato", porCausaDe: "linha_tempo" }]);
  });

  it("não duplica o que já está selecionado", () => {
    expect(dependenciasCitadas([TODAS[0]!, TODAS[1]!], TODAS)).toEqual([]);
  });

  it("não confunde prefixo em snake_case (historico_financeiro ≠ …_meses)", () => {
    // A citação em `historico_financeiro` é do _meses; o inverso não pode acontecer.
    const deps = dependenciasCitadas([TODAS[3]!], TODAS);
    expect(deps).toEqual([]);
  });

  it("sem citação, não puxa nada", () => {
    expect(dependenciasCitadas([TODAS[4]!], TODAS)).toEqual([]);
  });

  it("respeita o teto", () => {
    const muitas = [
      T("mae", "Mãe", "usa a1 a2 a3 a4 a5 a6 a7 a8"),
      ...["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8"].map((k) => T(k, k)),
    ];
    expect(dependenciasCitadas([muitas[0]!], muitas, 3)).toHaveLength(3);
  });
});

describe("selecionarTopK — integração com o desempate", () => {
  it("a vaga liberada pela perdedora vai para a próxima melhor", () => {
    const tools = [TG(HF, "hist_financeiro", 1), TG(BI, "hist_financeiro", 0), T("t3", "Charlie")];
    const sim = new Map([[HF, 0.77], [BI, 0.75], ["t3", 0.74]]);
    const cortes: CorteDesempate[][] = [];
    const keep = selecionarTopK(tools, "zzz", 2, undefined, sim, false, { onCorte: (c) => cortes.push(c) });
    expect(keep).toEqual(new Set([HF, "t3"])); // BI saiu; t3 ocupou a vaga
    expect(cortes[0]?.[0]).toMatchObject({ perdedora: BI, via: "grupo" });
  });

  it("sem regras nem grupos, o comportamento é o de antes", () => {
    const tools = [T("t1", "Alpha"), T("t2", "Bravo")];
    const sim = new Map([["t1", 0.75], ["t2", 0.72]]);
    expect(selecionarTopK(tools, "zzz", 12, undefined, sim)).toEqual(new Set(["t1", "t2"]));
  });
});

describe("forcaLexical — resgate do corte por módulo", () => {
  const PERGUNTA = "Existem candidatos que tem característica pra que possam participar do processo da requisição de pessoal 57695?";

  it("caso real: a tool citada na pergunta tem 2+ termos e sobrevive ao recorte", () => {
    expect(
      forcaLexical("Requisições: Requisição de pessoal (vaga/recrutamento)", "requisicoes_req_pessoal", PERGUNTA),
    ).toBeGreaterThanOrEqual(2);
  });

  it("as vizinhas do mesmo módulo NÃO são resgatadas (o recorte continua valendo)", () => {
    expect(forcaLexical("Requisições: Vaga", "requisicoes_req_vaga", PERGUNTA)).toBeLessThan(2);
    expect(forcaLexical("Requisições: Desligamento", "requisicoes_req_desligamento", PERGUNTA)).toBeLessThan(2);
    expect(forcaLexical("Seleção: Detalhe de vagas", "selecao_vagas", PERGUNTA)).toBeLessThan(2);
  });

  it("pergunta sem relação não resgata nada", () => {
    expect(forcaLexical("Requisições: Requisição de pessoal", "requisicoes_req_pessoal", "quantos dias de férias eu tenho")).toBe(0);
  });

  it("ignora acento e caixa", () => {
    expect(forcaLexical("Consultar Férias", "consultar_ferias", "quero CONSULTAR minhas ferias")).toBeGreaterThanOrEqual(2);
  });
});

/**
 * Caso real: "Me traga o histórico de cargos e salário dela" deveria cair na Linha do
 * Tempo — e não caía. O nome dela ("Linha do tempo do colaborador") não divide UMA
 * palavra com a pergunta, então ela dependia só do vetor e perdia para a ferramenta
 * chamada "Histórico financeiro". Os sinônimos existiam em `search_terms`, mas o
 * resgate lexical nunca os enxergava — o campo nem era carregado do banco.
 */
describe("forcaLexical enxerga os sinônimos", () => {
  const PERGUNTA = "Me traga o histórico de cargos e salário dela";
  const SINONIMOS = "histórico de cargos, histórico de salário, evolução salarial, progressão de carreira, mudanças de cargo";

  it("sem sinônimos, o nome sozinho não resgata", () => {
    expect(forcaLexical("Linha do tempo do colaborador", "linha_tempo", PERGUNTA)).toBeLessThan(2);
  });

  it("com sinônimos, passa o limiar do recorte (2 termos)", () => {
    expect(forcaLexical("Linha do tempo do colaborador", "linha_tempo", PERGUNTA, SINONIMOS)).toBeGreaterThanOrEqual(2);
  });

  it("sinônimo irrelevante não infla o resgate", () => {
    expect(forcaLexical("Consultar férias", "consultar_ferias", PERGUNTA, "saldo de férias, período aquisitivo")).toBe(0);
  });

  it("o resgate semântico também usa os sinônimos", () => {
    const tools: ToolLite[] = [
      { key: "historico_financeiro", name: "Histórico financeiro", description: "", alwaysInclude: false },
      { key: "linha_tempo", name: "Linha do tempo do colaborador", description: "", alwaysInclude: false, searchTerms: SINONIMOS },
    ];
    // A linha do tempo está BEM abaixo do piso — só o resgate lexical a salva.
    const sim = new Map([["historico_financeiro", 0.78], ["linha_tempo", 0.42]]);
    const keep = selecionarTopK(tools, PERGUNTA, 12, undefined, sim);
    expect(keep.has("linha_tempo")).toBe(true);
  });
});
