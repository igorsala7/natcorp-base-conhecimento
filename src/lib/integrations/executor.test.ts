import { describe, it, expect, vi } from "vitest";
import { executeTool, buildHttpRequest, type RuntimeTool, type RuntimeCredential } from "./executor";
import { resolveParams, buildModelSchema } from "./params";
import { invalidateOAuthToken } from "./oauth";

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  } as unknown as Response;
}

const feriasTool: RuntimeTool = {
  key: "consultar_ferias",
  name: "Consultar férias",
  method: "GET",
  path_template: "/ferias/{matricula}",
  auth_type: "oauth2",
  params: [
    { nome: "matricula", descricao: "", tipo: "string", origem: "identidade", obrigatorio: true, local: "path", campoIdentidade: "matricula" },
    { nome: "data_ini", descricao: "Início", tipo: "date", origem: "modelo", obrigatorio: true, local: "query", mascara: "dd/MM/yyyy" },
  ],
};

const oauthCred = (id: string): RuntimeCredential => ({
  id,
  auth_type: "oauth2",
  secret: { token_url: "https://erp.test/token", client_id: "cid", client_secret: "sec" },
});

describe("resolveParams", () => {
  it("injeta identidade, aplica máscara e distribui por local", () => {
    const b = resolveParams(feriasTool.params, { data_ini: "2026-08-01" }, { matricula: "12345" });
    expect(b.path).toEqual({ matricula: "12345" });
    expect(b.query).toEqual({ data_ini: "01/08/2026" });
  });

  it("lança se um parâmetro obrigatório de identidade está ausente", () => {
    expect(() => resolveParams(feriasTool.params, { data_ini: "2026-08-01" }, {})).toThrow(/matricula/);
  });

  it("buildModelSchema expõe SÓ os params do modelo", () => {
    const shape = buildModelSchema(feriasTool.params).shape;
    expect(Object.keys(shape)).toEqual(["data_ini"]); // matricula (identidade) fica de fora
  });
});

describe("buildHttpRequest", () => {
  it("substitui path, monta query e não põe body em GET", () => {
    const b = resolveParams(feriasTool.params, { data_ini: "2026-08-01" }, { matricula: "12345" });
    const req = buildHttpRequest(feriasTool, "https://api.cliente.com/v1/", b);
    const url = new URL(req.url);
    expect(url.pathname).toBe("/v1/ferias/12345");
    expect(url.searchParams.get("data_ini")).toBe("01/08/2026");
    expect(req.body).toBeUndefined();
  });

  it("rawPath: um enum de agrupamento composto vira segmentos do caminho (barras preservadas)", () => {
    const biTool: RuntimeTool = {
      key: "bi_hist_financeiro",
      name: "BI",
      method: "GET",
      path_template: "/bi/hist/{agrupamento}",
      auth_type: "oauth2",
      params: [
        { nome: "agrupamento", descricao: "", tipo: "enum", origem: "modelo", obrigatorio: true, local: "path", rawPath: true, opcoes: ["empresa/filial/cargo"] },
        { nome: "empresa", descricao: "", tipo: "string", origem: "modelo", obrigatorio: true, local: "query" },
      ],
    };
    const b = resolveParams(biTool.params, { agrupamento: "empresa/filial/cargo", empresa: "700" }, {});
    const req = buildHttpRequest(biTool, "https://api.cliente.com/v1/", b);
    // Sem rawPath, a barra viraria %2F e quebraria a rota.
    expect(new URL(req.url).pathname).toBe("/v1/bi/hist/empresa/filial/cargo");
    expect(new URL(req.url).searchParams.get("empresa")).toBe("700");
  });
});

describe("buildModelSchema com loop", () => {
  const loopTool: RuntimeTool = {
    key: "bi_hist_financeiro",
    name: "BI",
    method: "GET",
    path_template: "/bi/{agrupamento}",
    auth_type: "oauth2",
    loop: { unit: "month", param: "data_ref", from: "periodo_ini", to: "periodo_fim", max: 24 },
    params: [
      { nome: "agrupamento", descricao: "", tipo: "enum", origem: "modelo", obrigatorio: true, local: "path", rawPath: true, opcoes: ["empresa"] },
      { nome: "empresa", descricao: "", tipo: "string", origem: "modelo", obrigatorio: true, local: "query" },
      { nome: "data_ref", descricao: "", tipo: "date", origem: "modelo", obrigatorio: true, local: "query", mascara: "MM/yyyy" },
      { nome: "usuario", descricao: "", tipo: "string", origem: "identidade", obrigatorio: true, local: "query", campoIdentidade: "usuario" },
    ],
  };

  it("esconde o param mensal e expõe periodo_ini/periodo_fim (fim opcional)", () => {
    const shape = buildModelSchema(loopTool.params, loopTool.loop).shape;
    const keys = Object.keys(shape);
    expect(keys).toContain("agrupamento");
    expect(keys).toContain("empresa");
    expect(keys).toContain("periodo_ini");
    expect(keys).toContain("periodo_fim");
    expect(keys).not.toContain("data_ref"); // o servidor preenche por iteração
    expect(keys).not.toContain("usuario"); // identidade nunca vai ao modelo
    // periodo_ini obrigatório, periodo_fim opcional
    expect(shape.periodo_ini!.safeParse(undefined).success).toBe(false);
    expect(shape.periodo_fim!.safeParse(undefined).success).toBe(true);
  });
});

describe("executeTool (OAuth + identidade + máscara, fetch mockado)", () => {
  it("busca token, injeta Bearer e chama a API com os valores certos", async () => {
    invalidateOAuthToken("cred-1");
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.includes("/token")) return jsonResponse(200, { access_token: "TKN", expires_in: 3600 });
      return jsonResponse(200, { ferias: [{ ini: "01/08/2026", fim: "31/08/2026" }] });
    }) as unknown as typeof fetch;

    const res = await executeTool({
      tool: feriasTool,
      baseUrl: "https://api.cliente.com/v1",
      credential: oauthCred("cred-1"),
      modelArgs: { data_ini: "2026-08-01" },
      identity: { matricula: "12345" },
      fetchImpl: fetchMock,
    });

    expect(res.ok).toBe(true);
    expect(res.data).toEqual({ ferias: [{ ini: "01/08/2026", fim: "31/08/2026" }] });

    // 1ª chamada = token; 2ª = API
    expect(calls[0]!.url).toBe("https://erp.test/token");
    expect(String(calls[0]!.init?.body)).toContain("grant_type=client_credentials");
    const apiUrl = new URL(calls[1]!.url);
    expect(apiUrl.pathname).toBe("/v1/ferias/12345");
    expect(apiUrl.searchParams.get("data_ini")).toBe("01/08/2026");
    expect((calls[1]!.init?.headers as Record<string, string>).Authorization).toBe("Bearer TKN");
  });

  it("reaproveita o token do cache na 2ª execução (não rebusca)", async () => {
    invalidateOAuthToken("cred-2");
    let tokenCalls = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/token")) {
        tokenCalls++;
        return jsonResponse(200, { access_token: "TKN2", expires_in: 3600 });
      }
      return jsonResponse(200, { ok: true });
    }) as unknown as typeof fetch;

    const input = {
      tool: feriasTool,
      baseUrl: "https://api.cliente.com/v1",
      credential: oauthCred("cred-2"),
      modelArgs: { data_ini: "2026-08-01" },
      identity: { matricula: "1" },
      fetchImpl: fetchMock,
    };
    await executeTool(input);
    await executeTool(input);
    expect(tokenCalls).toBe(1); // cache evitou a 2ª busca de token
  });

  it("no 401 do OAuth, invalida e tenta 1× de novo", async () => {
    invalidateOAuthToken("cred-3");
    let apiHits = 0;
    let tokenHits = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/token")) {
        tokenHits++;
        return jsonResponse(200, { access_token: `TKN-${tokenHits}`, expires_in: 3600 });
      }
      apiHits++;
      return apiHits === 1 ? jsonResponse(401, { error: "expired" }) : jsonResponse(200, { ok: true });
    }) as unknown as typeof fetch;

    const res = await executeTool({
      tool: { ...feriasTool, params: [] },
      baseUrl: "https://api.cliente.com/v1",
      credential: oauthCred("cred-3"),
      modelArgs: {},
      identity: {},
      fetchImpl: fetchMock,
    });
    expect(apiHits).toBe(2); // tentou de novo
    expect(tokenHits).toBe(2); // renovou o token
    expect(res.ok).toBe(true);
  });
});
