import { describe, it, expect, vi } from "vitest";
import { resolveIdentity } from "./identity-resolver";
import { invalidateOAuthToken } from "./oauth";
import type { RuntimeCredential } from "./executor";

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

const cred = (id: string, sessionKey?: string): RuntimeCredential => ({
  id,
  auth_type: "oauth2",
  secret: {
    token_url: "https://erp.test/token",
    client_id: "c",
    client_secret: "s",
    ...(sessionKey ? { session_key: sessionKey } : {}),
  },
});

describe("resolveIdentity (login ORDS: validar + enriquecer)", () => {
  it("valida e injeta CPF + perfil gestor a partir do cadastro", async () => {
    invalidateOAuthToken("r1");
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/token")) return jsonResponse(200, { access_token: "T", expires_in: 3600 });
      if (url.includes("/autenticacao")) return jsonResponse(200, [{ empresa: "700", matricula: "365785", status: "OK" }]);
      if (url.includes("/dados_colab_usuario"))
        return jsonResponse(200, {
          items: [{ cpf: "070.386.368-12", gestor: "SIM", nome: "FERNANDO MATTOS TORRES", nome_cargo: "ANALISTA" }],
          count: 1,
        });
      return jsonResponse(404, {});
    }) as unknown as typeof fetch;

    const res = await resolveIdentity({
      baseUrl: "https://x/apex/rh/natcorp/",
      credential: cred("r1", "SK"),
      identity: { cod_empresa: "700", matricula: "365785", usuario: "365785" },
      fetchImpl: fetchMock,
    });

    expect(res.ok).toBe(true);
    expect(res.identity.cpf).toBe("070.386.368-12");
    expect(res.identity.perfil).toBe("gestor");
    expect(res.profile?.nome).toBe("FERNANDO MATTOS TORRES");
    expect(res.profile?.cargo).toBe("ANALISTA");
    // A query do perfil leva a key de sessão e empresa/matrícula.
    const profCall = (fetchMock as unknown as { mock: { calls: string[][] } }).mock.calls.find((c) =>
      String(c[0]).includes("dados_colab_usuario"),
    );
    expect(String(profCall?.[0])).toContain("key=SK");
    expect(String(profCall?.[0])).toContain("matricula=365785");
  });

  it("nega (ok:false) quando o usuário não valida e não busca o cadastro", async () => {
    invalidateOAuthToken("r2");
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/token")) return jsonResponse(200, { access_token: "T", expires_in: 3600 });
      if (url.includes("/autenticacao"))
        return jsonResponse(200, { status: "ERROR", message: "CPF e Telefone não cadastrados." });
      return jsonResponse(200, { items: [] });
    }) as unknown as typeof fetch;

    const res = await resolveIdentity({
      baseUrl: "https://x",
      credential: cred("r2", "SK"),
      identity: { cod_empresa: "700", matricula: "000000" },
      fetchImpl: fetchMock,
    });

    expect(res.ok).toBe(false);
    expect(res.identity.cpf).toBeUndefined();
    const calledProfile = (fetchMock as unknown as { mock: { calls: string[][] } }).mock.calls.some((c) =>
      String(c[0]).includes("dados_colab_usuario"),
    );
    expect(calledProfile).toBe(false);
  });

  it("é no-op (sem chamadas) sem session_key na credencial", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, {})) as unknown as typeof fetch;
    const res = await resolveIdentity({
      baseUrl: "https://x",
      credential: cred("r3"),
      identity: { cod_empresa: "700", matricula: "1" },
      fetchImpl: fetchMock,
    });
    expect(res.ok).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("é no-op sem empresa/matrícula na identidade", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, {})) as unknown as typeof fetch;
    const res = await resolveIdentity({
      baseUrl: "https://x",
      credential: cred("r4", "SK"),
      identity: {},
      fetchImpl: fetchMock,
    });
    expect(res.ok).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
