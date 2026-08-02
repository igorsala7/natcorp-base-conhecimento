import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/widget/auth", () => ({
  resolveWidgetKey: vi.fn(async () => ({ id: "k1", allowed_origins: [], rate_limit: 100 })),
  originAllowed: () => true,
  corsHeaders: () => ({}),
  clientIp: () => "1.2.3.4",
  extractKey: () => "pk_x",
  rateLimitOk: vi.fn(async () => true),
}));
vi.mock("@/lib/tracking/resolve", () => ({
  decodeTrackForSpace: vi.fn(async () => ({ p_base: "natcorp" })),
}));
vi.mock("@/lib/integrations/resolve", () => ({
  loadBaseTool: vi.fn(async () => ({
    baseUrl: "https://www.natcorpbr.com.br/apex/rh/natcorp",
    credentialId: "c1",
    pathTemplate: "chatbot/dados/v1/consulta_ir",
    method: "POST",
  })),
  loadCredentialSecret: vi.fn(async () => ({
    id: "c1",
    auth_type: "oauth2",
    secret: { token_url: "https://host/ords/natcorp/oauth/token", client_id: "cid", client_secret: "sec" },
  })),
}));
const getToken = vi.fn(async () => "TKN");
const invalidate = vi.fn(() => undefined);
vi.mock("@/lib/integrations/oauth", () => ({
  getOAuthToken: () => getToken(),
  invalidateOAuthToken: () => invalidate(),
}));

import { POST } from "./route";

type Call = { url: string; init: RequestInit };
function reqOf(body: unknown) {
  return new Request("https://api/report-data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

describe("POST /api/v1/report-data (ponte ORDS)", () => {
  beforeEach(() => { getToken.mockClear(); invalidate.mockClear(); });

  it("chama o módulo ORDS com Bearer e devolve o contrato", async () => {
    const calls: Call[] = [];
    global.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify({ ok: true, colunas: ["A", "B"], linhas: [["1", "2"], ["3", "4"]], total: 2 }), { status: 200 });
    }) as unknown as typeof fetch;

    const res = await POST(reqOf({ app_id: 200, page_id: 1, session: "987654321012345678", region: "HST" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, colunas: ["A", "B"], linhas: [["1", "2"], ["3", "4"]], total: 2 });
    // URL montada a partir do base_url REAL da natcorp + caminho do módulo
    expect(calls[0]!.url).toBe("https://www.natcorpbr.com.br/apex/rh/natcorp/chatbot/dados/v1/consulta_ir");
    // Bearer com o token OAuth
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe("Bearer TKN");
    // session preservada como TEXTO (sem perda de precisão)
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({
      app_id: 200,
      page_id: 1,
      session: "987654321012345678",
      region: "HST",
      username: "",
      items: JSON.stringify({ P_BASE: "natcorp" }), // só p_base veio no track mockado
    });
  });

  it("renova o token UMA vez no 401 e repete", async () => {
    let n = 0;
    global.fetch = vi.fn(async () => {
      n++;
      if (n === 1) return new Response("nope", { status: 401 });
      return new Response(JSON.stringify({ ok: true, colunas: ["A"], linhas: [["x"]], total: 1 }), { status: 200 });
    }) as unknown as typeof fetch;

    const res = await POST(reqOf({ app_id: 200, page_id: 1, session: "1", region: "" }));
    expect(res.status).toBe(200);
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(getToken).toHaveBeenCalledTimes(2);
  });

  it("resposta {ok:false} do ORDS → 502 repassando o erro", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ ok: false, erro: "sem IR" }), { status: 200 })) as unknown as typeof fetch;
    const res = await POST(reqOf({ app_id: 200, page_id: 1, session: "1" }));
    const body = await res.json();
    expect(res.status).toBe(502);
    expect(body.erro).toBe("sem IR");
  });

  it("faltando session → 400", async () => {
    const res = await POST(reqOf({ app_id: 200, page_id: 1 }));
    expect(res.status).toBe(400);
  });
});
