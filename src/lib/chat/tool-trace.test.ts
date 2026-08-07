import { describe, it, expect, vi } from "vitest";
import {
  familiaDaTool,
  instrumentarTools,
  paramsParaTrace,
  erroDoRetorno,
  resumoDoRetorno,
  MAX_PARAMS_CHARS,
} from "./tool-trace";

type Passo = { passo: string; info?: Record<string, unknown> };

function coletor() {
  const passos: Passo[] = [];
  return { passos, onPasso: (passo: string, info?: Record<string, unknown>) => passos.push({ passo, info }) };
}

describe("familiaDaTool", () => {
  it("classifica as ferramentas locais conhecidas", () => {
    expect(familiaDaTool("consultar_registros")).toBe("consulta");
    expect(familiaDaTool("montar_grafico")).toBe("visual");
    expect(familiaDaTool("preencher_campo")).toBe("tela");
    expect(familiaDaTool("coletar_relatorio")).toBe("coleta");
    expect(familiaDaTool("gerar_convite")).toBe("convite");
    expect(familiaDaTool("buscar_no_sistema")).toBe("fonte");
  });

  it("trata chave desconhecida como integração — as tools vêm do banco", () => {
    expect(familiaDaTool("bi_headcount")).toBe("integracao");
    expect(familiaDaTool("qualquer_coisa_nova")).toBe("integracao");
  });
});

describe("instrumentarTools", () => {
  it("emite tool_call com nome e parâmetros, e tool_fim com o desfecho", async () => {
    const { passos, onPasso } = coletor();
    const tools = instrumentarTools(
      { consultar_registros: { execute: async () => ({ total: 42, dataset: "ds1" }) } },
      onPasso,
    );
    await (tools.consultar_registros.execute as (a: unknown, o: unknown) => Promise<unknown>)(
      { dados_de: "ds1", filtros: [{ coluna: "Situação", valor: "Férias" }] },
      {},
    );

    expect(passos.map((p) => p.passo)).toEqual(["tool_call", "tool_fim"]);
    expect(passos[0]!.info).toMatchObject({ tool: "consultar_registros", familia: "consulta" });
    expect(passos[0]!.info!.params).toMatchObject({ dados_de: "ds1" });
    expect(passos[1]!.info).toMatchObject({ tool: "consultar_registros", ok: true });
    expect(passos[1]!.info!.resumo).toMatchObject({ total: 42, dataset: "ds1" });
  });

  it("registra como FALHA o retorno {erro} — é como guard, teto e endpoint ausente saem", async () => {
    const { passos, onPasso } = coletor();
    const tools = instrumentarTools(
      { bi_headcount: { execute: async () => ({ erro: "Já foram feitas 40 consultas nesta rodada" }) } },
      onPasso,
    );
    await (tools.bi_headcount.execute as (a: unknown, o: unknown) => Promise<unknown>)({}, {});

    const fim = passos.find((p) => p.passo === "tool_fim")!;
    expect(fim.info).toMatchObject({ ok: false });
    expect(String(fim.info!.erro)).toContain("40 consultas");
  });

  it("registra a exceção E a re-lança — o comportamento do chat não muda", async () => {
    const { passos, onPasso } = coletor();
    const tools = instrumentarTools(
      { bi_headcount: { execute: async () => { throw new Error("The operation was aborted"); } } },
      onPasso,
    );
    await expect(
      (tools.bi_headcount.execute as (a: unknown, o: unknown) => Promise<unknown>)({}, {}),
    ).rejects.toThrow("aborted");

    const fim = passos.find((p) => p.passo === "tool_fim")!;
    expect(fim.info).toMatchObject({ ok: false, excecao: true });
    expect(String(fim.info!.erro)).toContain("aborted");
  });

  it("repassa o 2º argumento intacto — perder o abortSignal quebraria o botão PARAR", async () => {
    const { onPasso } = coletor();
    const espiao = vi.fn(async (_args: unknown, _options: unknown) => ({ ok: true }));
    const tools = instrumentarTools({ x: { execute: espiao } }, onPasso);
    const controller = new AbortController();
    const options = { toolCallId: "call_1", abortSignal: controller.signal, messages: [] };

    await (tools.x.execute as (a: unknown, o: unknown) => Promise<unknown>)({ a: 1 }, options);

    expect(espiao).toHaveBeenCalledTimes(1);
    expect(espiao.mock.calls[0]![0]).toEqual({ a: 1 });
    expect(espiao.mock.calls[0]![1]).toBe(options);
  });

  it("devolve o mesmo valor do execute original", async () => {
    const { onPasso } = coletor();
    const retorno = { itens: [1, 2, 3] };
    const tools = instrumentarTools({ x: { execute: async () => retorno } }, onPasso);
    const r = await (tools.x.execute as (a: unknown, o: unknown) => Promise<unknown>)({}, {});
    expect(r).toBe(retorno);
  });

  it("deixa intacta a tool sem execute (executada pelo cliente)", () => {
    const { onPasso } = coletor();
    const def = { description: "sem execute" };
    const tools = instrumentarTools({ x: def }, onPasso);
    expect(tools.x).toBe(def);
  });

  it("sem onPasso, devolve o conjunto original sem custo", () => {
    const tools = { x: { execute: async () => 1 } };
    expect(instrumentarTools(tools)).toBe(tools);
  });
});

describe("paramsParaTrace", () => {
  it("mascara valor de campo com cara de segredo", () => {
    const r = paramsParaTrace({ matricula: "4471", session_key: "abc123xyz", p_token: "t0k3n" }) as Record<string, unknown>;
    expect(r.matricula).toBe("4471");
    expect(r.session_key).toBe("***");
    expect(r.p_token).toBe("***");
  });

  it("preserva os parâmetros de negócio — mascarar demais mata a depuração", () => {
    const r = paramsParaTrace({ empresa: "1", centro_custo: "97", competencia: "2026-08" }) as Record<string, unknown>;
    expect(r).toEqual({ empresa: "1", centro_custo: "97", competencia: "2026-08" });
  });

  it("corta args gigantes preservando o começo legível", () => {
    const r = paramsParaTrace({ lista: "x".repeat(5000) }) as Record<string, unknown>;
    expect(r._cortado).toBe(true);
    expect(String(r.texto).length).toBeLessThanOrEqual(MAX_PARAMS_CHARS + 1);
    expect(String(r.texto)).toContain("lista");
  });
});

describe("erroDoRetorno / resumoDoRetorno", () => {
  it("só considera erro string não-vazia", () => {
    expect(erroDoRetorno({ erro: "falhou" })).toBe("falhou");
    expect(erroDoRetorno({ erro: "" })).toBeUndefined();
    expect(erroDoRetorno({ dados: [] })).toBeUndefined();
    expect(erroDoRetorno(null)).toBeUndefined();
  });

  it("resume só escalares conhecidos, ignorando o payload", () => {
    expect(resumoDoRetorno({ total: 10, itens: [1, 2, 3], tipo: "barra" })).toEqual({ total: 10, tipo: "barra" });
    expect(resumoDoRetorno({ itens: [1, 2] })).toBeUndefined();
    expect(resumoDoRetorno([1, 2])).toBeUndefined();
  });
});
