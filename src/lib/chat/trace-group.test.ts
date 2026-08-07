import { describe, it, expect } from "vitest";
import { agruparPassos, chamadaFalhou, verboDoCurl, alvoDoCurl, todosOsCurls, type TracePasso } from "./trace-group";

const p = (ms: number, passo: string, info?: Record<string, unknown>): TracePasso => ({ ms, passo, info });

const CURL = "curl -X GET 'https://api.interna/ords/rh/v1/headcount?empresa=1' \\\n  -H 'Authorization: ***REDIGIDO***'";

describe("agruparPassos", () => {
  it("junta os quatro passos de uma chamada num cartão só", () => {
    const itens = agruparPassos([
      p(10, "mensagem", { pergunta: "quantos ativos?" }),
      p(50, "tool_call", { tool: "bi_headcount", familia: "integracao", params: { empresa: "1" } }),
      p(900, "integracoes:curl", { tool: "bi_headcount", status: 200, ms: 840, curl: CURL }),
      p(905, "tool_result", { tool: "bi_headcount", dataset: "ds1", total: 3412, amostra_enviada: 50 }),
      p(910, "tool_fim", { tool: "bi_headcount", ok: true, ms: 860 }),
      p(2000, "resposta", { chars: 400 }),
    ]);

    expect(itens.map((i) => i.tipo)).toEqual(["passo", "ferramenta", "passo"]);
    const c = (itens[1] as Extract<typeof itens[number], { tipo: "ferramenta" }>).chamada;
    expect(c.tool).toBe("bi_headcount");
    expect(c.ms).toBe(50); // ancorado no início da chamada
    expect(c.params).toEqual({ empresa: "1" });
    expect(c.curl).toBe(CURL);
    expect(c.status).toBe(200);
    expect(c.ok).toBe(true);
    expect(c.relato).toMatchObject({ dataset: "ds1", total: 3412 });
    expect(c.relato!.tool).toBeUndefined(); // não repete a chave dentro do relato
  });

  // O SDK executa as tool-calls de um passo EM PARALELO, então elas terminam fora da
  // ordem em que começaram. Casar por ordem colava o cURL e o veredito de uma chamada
  // no cartão de outra — o log MENTIA sobre qual consulta falhou.
  it("não troca os dados entre chamadas paralelas da MESMA ferramenta (casa por id)", () => {
    const itens = agruparPassos([
      p(10, "tool_call", { id: "c1", tool: "ficha", params: { matricula: "1111" } }),
      p(20, "tool_call", { id: "c2", tool: "ficha", params: { matricula: "2222" } }),
      // c2 termina PRIMEIRO — é o caso normal, não o exótico
      p(700, "integracoes:curl", { id: "c2", tool: "ficha", status: 200, curl: "curl -X GET 'https://api/ficha?m=2222'" }),
      p(710, "tool_fim", { id: "c2", tool: "ficha", ok: true, ms: 690 }),
      p(900, "integracoes:curl", { id: "c1", tool: "ficha", status: 500, curl: "curl -X GET 'https://api/ficha?m=1111'" }),
      p(910, "tool_fim", { id: "c1", tool: "ficha", ok: false, erro: "A API retornou HTTP 500", ms: 900 }),
    ]);
    const cs = itens.flatMap((i) => (i.tipo === "ferramenta" ? [i.chamada] : []));
    expect(cs).toHaveLength(2);
    // A matrícula 1111 é a que falhou — e o cartão dela tem que dizer isso.
    expect(cs[0]!.params).toEqual({ matricula: "1111" });
    expect(cs[0]!.status).toBe(500);
    expect(cs[0]!.ok).toBe(false);
    expect(cs[0]!.curl).toContain("m=1111");
    expect(cs[1]!.params).toEqual({ matricula: "2222" });
    expect(cs[1]!.status).toBe(200);
    expect(cs[1]!.curl).toContain("m=2222");
  });

  it("sem id (trace antigo), casa por ordem — e passo órfão vira cartão próprio", () => {
    const itens = agruparPassos([
      p(10, "tool_call", { tool: "consultar_registros", params: { dados_de: "A" } }),
      p(30, "tool_fim", { tool: "consultar_registros", ok: true, ms: 20 }),
      // Sem tool_call correspondente: NÃO pode sobrescrever o cartão anterior
      p(40, "tool_fim", { tool: "consultar_registros", ok: false, erro: "boom", ms: 20 }),
    ]);
    const cs = itens.flatMap((i) => (i.tipo === "ferramenta" ? [i.chamada] : []));
    expect(cs).toHaveLength(2);
    expect(cs[0]!.params).toEqual({ dados_de: "A" });
    expect(cs[0]!.ok).toBe(true);
    expect(cs[0]!.erro).toBeUndefined(); // o erro da 2ª NÃO vazou para a 1ª
    expect(cs[1]!.ok).toBe(false);
  });

  it("o badge de repetida vai para a chamada DEDUPLICADA, não para a real", () => {
    const itens = agruparPassos([
      p(10, "tool_call", { id: "c1", tool: "bi_headcount", params: { a: 1 } }),
      p(11, "tool_call", { id: "c2", tool: "bi_headcount", params: { a: 1 } }),
      p(12, "integracoes:dedup", { id: "c2", tool: "bi_headcount" }),
      p(500, "integracoes:curl", { id: "c1", tool: "bi_headcount", status: 200, curl: CURL }),
      p(510, "tool_fim", { id: "c1", tool: "bi_headcount", ok: true, ms: 500 }),
      p(13, "tool_fim", { id: "c2", tool: "bi_headcount", ok: true, ms: 1 }),
    ]);
    const cs = itens.flatMap((i) => (i.tipo === "ferramenta" ? [i.chamada] : []));
    expect(cs[0]!.dedup).toBeUndefined(); // a que foi à rede
    expect(cs[0]!.curl).toBe(CURL);
    expect(cs[1]!.dedup).toBe(true); // a repetida
    expect(cs[1]!.curl).toBeUndefined();
  });

  it("recusa de guard aparece com o NOME do guard e conta como falha", () => {
    const itens = agruparPassos([
      p(10, "tool_call", { id: "c1", tool: "ficha", params: { matricula: "9999" } }),
      p(20, "integracoes:guard", { id: "c1", tool: "ficha", guard: "team_membership", ok: false, erro: "fora da sua equipe" }),
      p(21, "tool_fim", { id: "c1", tool: "ficha", ok: false, erro: "fora da sua equipe", ms: 11 }),
    ]);
    const c = (itens[0] as Extract<typeof itens[number], { tipo: "ferramenta" }>).chamada;
    expect(c.guard).toEqual({ nome: "team_membership", erro: "fora da sua equipe" });
    expect(chamadaFalhou(c)).toBe(true);
  });

  it("propaga a marca de poda para a tela avisar que o cURL está cortado", () => {
    const itens = agruparPassos([
      p(10, "tool_call", { id: "c1", tool: "t", params: {} }),
      p(20, "integracoes:curl", { id: "c1", tool: "t", status: 200, curl: "curl -X POST 'x' …", _podado: ["curl"] }),
    ]);
    const c = (itens[0] as Extract<typeof itens[number], { tipo: "ferramenta" }>).chamada;
    expect(c.podado).toEqual(["curl"]);
  });

  it("ferramenta local aparece com nome e parâmetros mesmo sem cURL", () => {
    const itens = agruparPassos([
      p(10, "tool_call", { tool: "montar_grafico", familia: "visual", params: { tipo: "barra", dados_de: "ds1" } }),
      p(30, "tool_fim", { tool: "montar_grafico", familia: "visual", ok: true, ms: 12 }),
    ]);
    const c = (itens[0] as Extract<typeof itens[number], { tipo: "ferramenta" }>).chamada;
    expect(c.familia).toBe("visual");
    expect(c.curl).toBeUndefined();
    expect(c.params).toMatchObject({ tipo: "barra" });
  });

  it("marca a chamada servida do dedup", () => {
    const itens = agruparPassos([
      p(10, "tool_call", { tool: "bi_headcount", params: {} }),
      p(11, "integracoes:dedup", { tool: "bi_headcount" }),
      p(12, "tool_fim", { tool: "bi_headcount", ok: true, ms: 1 }),
    ]);
    const c = (itens[0] as Extract<typeof itens[number], { tipo: "ferramenta" }>).chamada;
    expect(c.dedup).toBe(true);
  });

  it("trace ANTIGO (curl sem tool_call) continua legível", () => {
    const itens = agruparPassos([p(90, "integracoes:curl", { tool: "bi_headcount", status: 200, curl: CURL })]);
    expect(itens).toHaveLength(1);
    expect(itens[0]!.tipo).toBe("ferramenta");
    const c = (itens[0] as Extract<typeof itens[number], { tipo: "ferramenta" }>).chamada;
    expect(c.curl).toBe(CURL);
  });

  it("passo desconhecido nunca some da tela", () => {
    const itens = agruparPassos([p(1, "rag", { fontes: 3 }), p(2, "ontologia", { termos: 4 })]);
    expect(itens.map((i) => (i.tipo === "passo" ? i.passo.passo : "?"))).toEqual(["rag", "ontologia"]);
  });

  it("guarda o loop colapsado: uma chamada, N requisições", () => {
    const itens = agruparPassos([
      p(10, "tool_call", { tool: "historico_financeiro", params: { de: "2026-01", ate: "2026-12" } }),
      p(9000, "integracoes:curl", {
        tool: "historico_financeiro", requisicoes: 12, valores: ["2026-01", "2026-02"], status: 200, ms: 8800, curl: CURL,
      }),
      p(9010, "tool_fim", { tool: "historico_financeiro", ok: true, ms: 8900 }),
    ]);
    const c = (itens[0] as Extract<typeof itens[number], { tipo: "ferramenta" }>).chamada;
    expect(c.requisicoes).toBe(12);
    expect(c.valores).toEqual(["2026-01", "2026-02"]);
  });
});

describe("chamadaFalhou", () => {
  const base = { tool: "t", ms: 0, passos: [] };
  it("pega erro declarado, HTTP >= 400 e perda de dados", () => {
    expect(chamadaFalhou({ ...base, ok: false })).toBe(true);
    expect(chamadaFalhou({ ...base, erro: "guard recusou" })).toBe(true);
    expect(chamadaFalhou({ ...base, status: 500 })).toBe(true);
    expect(chamadaFalhou({ ...base, status: [200, 404] })).toBe(true);
    expect(chamadaFalhou({ ...base, relato: { sem_dados: true } })).toBe(true);
    expect(chamadaFalhou({ ...base, relato: { poda_agressiva: true } })).toBe(true);
  });
  it("chamada saudável não é marcada", () => {
    expect(chamadaFalhou({ ...base, ok: true, status: 200, relato: { total: 10 } })).toBe(false);
  });
});

describe("leitura do cURL", () => {
  it("extrai verbo e encurta a URL preservando a completa", () => {
    expect(verboDoCurl(CURL)).toBe("GET");
    expect(alvoDoCurl(CURL)).toEqual({
      curto: "/ords/rh/v1/headcount?empresa=1",
      completo: "https://api.interna/ords/rh/v1/headcount?empresa=1",
    });
    expect(verboDoCurl(undefined)).toBeNull();
    expect(alvoDoCurl("sem url")).toBeNull();
  });

  it("junta os cURLs do turno rotulados pela ferramenta", () => {
    const itens = agruparPassos([
      p(10, "tool_call", { tool: "a", params: {} }),
      p(20, "integracoes:curl", { tool: "a", status: 200, curl: CURL }),
      p(30, "tool_call", { tool: "montar_grafico", familia: "visual", params: {} }),
    ]);
    const txt = todosOsCurls(itens);
    expect(txt).toContain("# a");
    expect(txt).toContain("curl -X GET");
    expect(txt).not.toContain("montar_grafico"); // local não tem cURL
  });
});
