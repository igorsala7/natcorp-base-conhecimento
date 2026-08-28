import { describe, expect, it } from "vitest";
import {
  agrupar,
  fracaoCacheCobrada,
  fracaoEntradaEmCache,
  somar,
  tokensCobrados,
  valorUsd,
  custoPorMilhao,
  margemPorMilhao,
  type LinhaFaturamento,
} from "./pricing";

/**
 * Os números abaixo são REAIS: saíram de `faturamento_detalhe` sobre a janela
 * 08/08/2026 02:58–03:13Z, a conversa que motivou este trabalho. Usar dados
 * inventados aqui testaria a aritmética e não o acordo com o banco — e é
 * exatamente o acordo que precisa continuar valendo, já que a RPC pondera do
 * lado do Postgres e este módulo re-deriva o cache por subtração.
 */
const base = (over: Partial<LinhaFaturamento>): LinhaFaturamento => ({
  cliente: "NATCORP",
  origem: "widget",
  kind: "user",
  provider: "anthropic",
  model: "claude-haiku-4-5",
  purpose: "chat_ferramentas",
  chamadas: 1,
  entrada_total: 0,
  entrada_nova: 0,
  cache_read: 0,
  cache_write: 0,
  saida: 0,
  tokens_brutos: 0,
  tokens_ponderados: 0,
  cache_read_mult: 0.1,
  cache_write_mult: 1.25,
  preco_confirmado: true,
  custo_usd: null,
  ...over,
});

/** Haiku 4.5 com o cache quente — a linha que domina a conversa. */
const HAIKU = base({
  chamadas: 14,
  entrada_total: 752_675,
  entrada_nova: 60_287,
  cache_read: 444_519,
  cache_write: 247_869,
  saida: 12_259,
  tokens_brutos: 764_934,
  tokens_ponderados: 426_834,
  custo_usd: 0.475_87,
});

/** Gemini sem preço cadastrado — o caso que não pode virar "custo zero". */
const GEMINI = base({
  provider: "google",
  model: "gemini-3.5-flash",
  purpose: "report_analysis",
  chamadas: 5,
  entrada_total: 171_423,
  entrada_nova: 97_970,
  cache_read: 73_453,
  cache_write: 0,
  saida: 7_306,
  tokens_brutos: 178_729,
  tokens_ponderados: 178_729,
  cache_read_mult: 1,
  cache_write_mult: 1,
  preco_confirmado: false,
  custo_usd: null,
});

/** Reescrita de consulta: disparada pelo sistema DENTRO do turno cobrável. */
const OVERHEAD = base({
  provider: "google",
  model: "gemini-3.5-flash-lite",
  purpose: "query_rewrite",
  kind: "system",
  chamadas: 9,
  entrada_total: 14_399,
  entrada_nova: 14_399,
  saida: 208,
  tokens_brutos: 14_607,
  tokens_ponderados: 14_607,
  cache_read_mult: 1,
  cache_write_mult: 1,
  preco_confirmado: false,
});

describe("somar", () => {
  it("deriva o cache equivalente por subtração, batendo com os multiplicadores", () => {
    const t = somar([HAIKU]);
    // 444.519×0,10 + 247.869×1,25 = 354.288
    expect(t.cacheEquivalente).toBe(354_288);
    expect(t.cacheEquivalente).toBe(
      Math.round(HAIKU.cache_read * 0.1 + HAIKU.cache_write * 1.25),
    );
  });

  it("mede a economia do cache em tokens", () => {
    const t = somar([HAIKU]);
    expect(t.tokensBrutos).toBe(764_934);
    expect(t.tokensPonderados).toBe(426_834);
    expect(t.economia).toBe(338_100);
  });

  it("devolve custo nulo quando ALGUM modelo do grupo não tem preço", () => {
    // O Haiku sozinho tem custo conhecido…
    expect(somar([HAIKU]).custoUsd).toBeCloseTo(0.47587, 5);
    // …mas somado a um modelo sem preço, um custo parcial passaria por total.
    const t = somar([HAIKU, GEMINI]);
    expect(t.custoUsd).toBeNull();
    expect(t.temPrecoAusente).toBe(true);
  });

  it("não devolve cache equivalente negativo com arredondamento adverso", () => {
    const t = somar([
      base({ entrada_total: 10, entrada_nova: 9, cache_read: 1, saida: 5, tokens_brutos: 15, tokens_ponderados: 13 }),
    ]);
    expect(t.cacheEquivalente).toBe(0);
  });

  it("soma vazia é zero, não NaN", () => {
    const t = somar([]);
    expect(t.tokensBrutos).toBe(0);
    expect(t.custoUsd).toBeNull();
  });

  it("aceita numérico vindo do Postgres como string", () => {
    const t = somar([{ ...HAIKU, tokens_brutos: "764934" as unknown as number }]);
    expect(t.tokensBrutos).toBe(764_934);
  });
});

describe("frações de cache", () => {
  it("mede quanto do cache é realmente cobrado", () => {
    const f = fracaoCacheCobrada(somar([HAIKU]));
    // 354.288 de 692.388 tokens em cache → ~51%
    expect(f).toBeCloseTo(0.5117, 4);
  });

  it("passa de 100% quando a ESCRITA domina — caro, não é bug", () => {
    const soEscrita = base({
      entrada_total: 100_000,
      entrada_nova: 0,
      cache_write: 100_000,
      saida: 0,
      tokens_brutos: 100_000,
      tokens_ponderados: 125_000,
    });
    expect(fracaoCacheCobrada(somar([soEscrita]))!).toBeCloseTo(1.25, 4);
  });

  it("sem cache nenhum, não inventa fração", () => {
    expect(fracaoCacheCobrada(somar([OVERHEAD]))).toBeNull();
  });

  it("mede a fatia da entrada que veio do cache", () => {
    expect(fracaoEntradaEmCache(somar([HAIKU]))!).toBeCloseTo(0.9199, 4);
  });
});

describe("tokensCobrados", () => {
  const turno = [HAIKU, GEMINI, OVERHEAD];

  it("na base bruta, soma tudo que trafegou", () => {
    expect(tokensCobrados(turno, "bruto")).toBe(764_934 + 178_729 + 14_607);
  });

  it("na base ponderada, o cache barato encolhe a conta", () => {
    expect(tokensCobrados(turno, "ponderado")).toBe(426_834 + 178_729 + 14_607);
  });

  it("sem cobrar overhead, tira o que o sistema disparou por conta própria", () => {
    expect(tokensCobrados(turno, "bruto", false)).toBe(764_934 + 178_729);
  });

  it("as duas bases divergem o bastante para a escolha importar", () => {
    const bruto = tokensCobrados(turno, "bruto");
    const pond = tokensCobrados(turno, "ponderado");
    expect(pond / bruto).toBeLessThan(0.7);
  });
});

describe("valorUsd", () => {
  it("aplica a tarifa plana por milhão", () => {
    expect(valorUsd(972_448, 5)).toBeCloseTo(4.8622, 4);
    expect(valorUsd(0, 5)).toBe(0);
  });
});

describe("agrupar", () => {
  const turno = [HAIKU, GEMINI, OVERHEAD];

  it("os subtotais fecham com o total geral", () => {
    const geral = somar(turno);
    for (const chave of [
      (l: LinhaFaturamento) => l.provider,
      (l: LinhaFaturamento) => l.model,
      (l: LinhaFaturamento) => l.purpose,
      (l: LinhaFaturamento) => l.cliente,
    ]) {
      const soma = agrupar(turno, chave).reduce((a, g) => a + g.totais.tokensBrutos, 0);
      expect(soma).toBe(geral.tokensBrutos);
    }
  });

  it("ordena do maior para o menor", () => {
    expect(agrupar(turno, (l) => l.model).map((g) => g.chave)).toEqual([
      "claude-haiku-4-5",
      "gemini-3.5-flash",
      "gemini-3.5-flash-lite",
    ]);
  });

  it("a base escolhida muda a ordem quando o cache inverte o peso", () => {
    // Dois modelos com o MESMO bruto: um todo em cache lido (barato), outro sem
    // cache nenhum. Em bruto empatam e a ordem é a de inserção; em ponderado o
    // sem-cache passa na frente. É essa inversão que o painel precisa mostrar
    // para "quem consome mais" não significar coisas diferentes em cada aba.
    const cacheado = base({
      model: "cacheado",
      entrada_total: 100_000, entrada_nova: 0, cache_read: 100_000,
      saida: 0, tokens_brutos: 100_000, tokens_ponderados: 10_000,
    });
    const cru = base({
      model: "cru",
      entrada_total: 100_000, entrada_nova: 100_000,
      saida: 0, tokens_brutos: 100_000, tokens_ponderados: 100_000,
    });
    expect(agrupar([cacheado, cru], (l) => l.model, "bruto")[0]!.chave).toBe("cacheado");
    expect(agrupar([cacheado, cru], (l) => l.model, "ponderado")[0]!.chave).toBe("cru");
  });

  it("chave vazia vira travessão em vez de sumir do total", () => {
    const g = agrupar([base({ purpose: "", tokens_brutos: 10 })], (l) => l.purpose);
    expect(g).toHaveLength(1);
    expect(g[0]!.chave).toBe("—");
  });
});

/**
 * Os números desta seção também são REAIS: `faturamento_detalhe` sobre os 14
 * dias encerrados em 28/08/2026, todas as origens. Foi a pergunta "quanto estou
 * pagando por 1 milhão de tokens" que motivou a métrica.
 */
describe("custoPorMilhao", () => {
  it("o número dos 14 dias: US$ 1,61 por milhão bruto", () => {
    const t = somar([
      base({ tokens_brutos: 74_388_986, tokens_ponderados: 58_081_240, custo_usd: 119.63 }),
    ]);
    expect(custoPorMilhao(t, "bruto")).toBeCloseTo(1.608, 3);
  });

  it("na base ponderada sai MAIS caro — são menos tokens para o mesmo dólar", () => {
    // Contra-intuitivo e proposital: a ponderação desconta o cache da CONTAGEM,
    // não do custo. Quem lê "ponderado" como "com desconto" erra o sinal.
    const t = somar([
      base({ tokens_brutos: 74_388_986, tokens_ponderados: 58_081_240, custo_usd: 119.63 }),
    ]);
    expect(custoPorMilhao(t, "ponderado")!).toBeGreaterThan(custoPorMilhao(t, "bruto")!);
    expect(custoPorMilhao(t, "ponderado")).toBeCloseTo(2.06, 2);
  });

  it("separa o uso interno do uso do cliente — 2,92 contra 0,88", () => {
    // O achado que o custo total em dólar escondia: `sistema` é 36% dos tokens
    // e 65% do dinheiro.
    const sistema = somar([base({ origem: "sistema", tokens_brutos: 26_481_549, custo_usd: 77.36 })]);
    const widget = somar([base({ origem: "widget", tokens_brutos: 47_596_399, custo_usd: 41.71 })]);
    expect(custoPorMilhao(sistema, "bruto")).toBeCloseTo(2.92, 2);
    expect(custoPorMilhao(widget, "bruto")).toBeCloseTo(0.88, 2);
  });

  it("sem preço confirmado devolve null, nunca zero", () => {
    // Custo desconhecido dividido pelo total daria um número menor que a
    // verdade, com cara de exato.
    const t = somar([base({ tokens_brutos: 1_000_000, custo_usd: null, preco_confirmado: false })]);
    expect(t.custoUsd).toBeNull();
    expect(custoPorMilhao(t, "bruto")).toBeNull();
  });

  it("período sem token não vira divisão por zero", () => {
    expect(custoPorMilhao(somar([base({ custo_usd: 0 })]), "bruto")).toBeNull();
  });
});

describe("margemPorMilhao", () => {
  it("tarifa de 5,00 sobre custo de 1,61 deixa 3,39 por milhão", () => {
    const t = somar([
      base({ tokens_brutos: 74_388_986, tokens_ponderados: 58_081_240, custo_usd: 119.63 }),
    ]);
    expect(margemPorMilhao(t, "bruto", 5)).toBeCloseTo(3.39, 2);
  });

  it("margem negativa aparece como negativa, não some", () => {
    // Um mix caro pode passar da tarifa; esconder isso seria o pior dos casos.
    const t = somar([base({ tokens_brutos: 1_000_000, custo_usd: 8 })]);
    expect(margemPorMilhao(t, "bruto", 5)).toBeCloseTo(-3, 5);
  });

  it("sem preço não há margem a afirmar", () => {
    const t = somar([base({ tokens_brutos: 1_000_000, custo_usd: null, preco_confirmado: false })]);
    expect(margemPorMilhao(t, "bruto", 5)).toBeNull();
  });
});
