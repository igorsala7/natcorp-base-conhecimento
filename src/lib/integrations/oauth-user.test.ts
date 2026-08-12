import { describe, expect, it, vi } from "vitest";
import {
  deveConferirEmailFuncional,
  escoposDe,
  lerPerfil,
  precisaRenovar,
  renovar,
  trocarCodigo,
  urlDeConsentimento,
  urlDeToken,
  type ConfigDelegada,
} from "./oauth-user";

const CFG: ConfigDelegada = {
  client_id: "cid-123",
  client_secret: "segredo",
  tenant: "746eb855-51c5-420f-bc64-29cf0478b563",
};

const respostaOk = (body: unknown, ok = true, status = 200) =>
  vi.fn().mockResolvedValue({ ok, status, json: async () => body } as unknown as Response);

describe("deveConferirEmailFuncional", () => {
  // Credencial da BASE = app no diretório do cliente: ali a conta do SSO e o
  // e-mail funcional são a mesma coisa, e o parâmetro do administrador não pode
  // afrouxar a conferência.
  it("credencial da própria base confere sempre, mesmo com o campo desligado", () => {
    expect(deveConferirEmailFuncional({ propriaDaBase: true, cfg: CFG })).toBe(true);
  });

  it("credencial global só confere quando o administrador liga", () => {
    expect(deveConferirEmailFuncional({ propriaDaBase: false, cfg: CFG })).toBe(false);
    expect(
      deveConferirEmailFuncional({ propriaDaBase: false, cfg: { ...CFG, exigir_email_funcional: "1" } }),
    ).toBe(true);
  });
});

describe("urlDeConsentimento", () => {
  it("usa o tenant configurado — registro single-tenant não aceita /common", () => {
    const u = new URL(urlDeConsentimento({ provider: "microsoft", cfg: CFG, redirectUri: "https://x/cb", nonce: "n1" }));
    expect(u.origin + u.pathname).toBe(
      "https://login.microsoftonline.com/746eb855-51c5-420f-bc64-29cf0478b563/oauth2/v2.0/authorize",
    );
    expect(u.searchParams.get("client_id")).toBe("cid-123");
    expect(u.searchParams.get("state")).toBe("n1");
    expect(u.searchParams.get("redirect_uri")).toBe("https://x/cb");
  });

  it("sem tenant, cai em `common` (multi-tenant)", () => {
    const u = new URL(
      urlDeConsentimento({ provider: "microsoft", cfg: { ...CFG, tenant: undefined }, redirectUri: "https://x/cb", nonce: "n" }),
    );
    expect(u.pathname).toContain("/common/");
  });

  it("pede offline_access na Microsoft — sem ele não vem refresh_token", () => {
    const u = new URL(urlDeConsentimento({ provider: "microsoft", cfg: CFG, redirectUri: "https://x/cb", nonce: "n" }));
    expect(u.searchParams.get("scope")).toContain("offline_access");
  });

  it("pré-seleciona a conta do cadastro (login_hint) nos dois provedores", () => {
    // Navegador logado no e-mail pessoal é o caso comum: sem a dica, a tela
    // oferece a conta errada e conectar a errada é um erro silencioso.
    for (const provider of ["microsoft", "google"] as const) {
      const u = new URL(
        urlDeConsentimento({ provider, cfg: CFG, redirectUri: "https://x/cb", nonce: "n", loginHint: " maria@empresa.com " }),
      );
      expect(u.searchParams.get("login_hint")).toBe("maria@empresa.com");
    }
  });

  it("sem e-mail conhecido, não manda login_hint vazio", () => {
    // `login_hint=` em branco faz a Microsoft abrir na tela de erro em vez do
    // seletor de contas.
    for (const hint of [null, undefined, "  "]) {
      const u = new URL(
        urlDeConsentimento({ provider: "microsoft", cfg: CFG, redirectUri: "https://x/cb", nonce: "n", loginHint: hint }),
      );
      expect(u.searchParams.has("login_hint")).toBe(false);
    }
  });

  it("silencioso manda prompt=none — e não o consent, que é excludente", () => {
    // A tentativa silenciosa aproveita a sessão do SSO do anfitrião. Mandar os
    // dois `prompt` na mesma URL é erro de protocolo e o provedor recusa antes
    // de olhar qualquer outra coisa.
    for (const provider of ["microsoft", "google"] as const) {
      const u = new URL(
        urlDeConsentimento({ provider, cfg: CFG, redirectUri: "https://x/cb", nonce: "n", silencioso: true }),
      );
      expect(u.searchParams.getAll("prompt")).toEqual(["none"]);
    }
  });

  it("fora do silencioso, o Google mantém prompt=consent (é o que traz refresh_token)", () => {
    const u = new URL(urlDeConsentimento({ provider: "google", cfg: CFG, redirectUri: "https://x/cb", nonce: "n" }));
    expect(u.searchParams.get("prompt")).toBe("consent");
    expect(u.searchParams.get("access_type")).toBe("offline");
  });

  it("no Google, força access_type=offline e prompt=consent", () => {
    // Sem os dois, uma RECONEXÃO devolve só access_token e a conta quebra uma
    // hora depois — falha que só aparece em produção.
    const u = new URL(urlDeConsentimento({ provider: "google", cfg: CFG, redirectUri: "https://x/cb", nonce: "n" }));
    expect(u.searchParams.get("access_type")).toBe("offline");
    expect(u.searchParams.get("prompt")).toBe("consent");
  });

  it("o piloto pede só leitura — nenhum escopo de escrita", () => {
    for (const provider of ["microsoft", "google"] as const) {
      const escopos = escoposDe(provider, CFG);
      expect(escopos).not.toMatch(/Mail\.Send|Mail\.ReadWrite|Calendars\.ReadWrite|Files\.ReadWrite/);
      expect(escopos).not.toMatch(/gmail\.send|gmail\.modify|drive(?!\.readonly)/);
    }
  });

  it("escopos podem ser sobrescritos pela credencial do cliente", () => {
    expect(escoposDe("microsoft", { ...CFG, scopes: "User.Read" })).toBe("User.Read");
  });
});

describe("trocarCodigo", () => {
  it("manda authorization_code com o segredo do cliente", async () => {
    const f = respostaOk({ access_token: "at", refresh_token: "rt", expires_in: 3600, scope: "User.Read Mail.Read" });
    const t = await trocarCodigo({
      provider: "microsoft", cfg: CFG, code: "c1", redirectUri: "https://x/cb",
      fetchImpl: f as unknown as typeof fetch, agora: 1_000_000,
    });
    const body = new URLSearchParams((f.mock.calls[0]![1] as RequestInit).body as string);
    expect(f.mock.calls[0]![0]).toBe(urlDeToken("microsoft", CFG));
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("c1");
    expect(body.get("client_secret")).toBe("segredo");
    expect(t.accessToken).toBe("at");
    expect(t.refreshToken).toBe("rt");
    expect(t.scopes).toEqual(["User.Read", "Mail.Read"]);
  });

  it("desconta 60s da validade — token que expira em 3s falha no meio do turno", async () => {
    const f = respostaOk({ access_token: "at", expires_in: 3600 });
    const t = await trocarCodigo({
      provider: "microsoft", cfg: CFG, code: "c", redirectUri: "r",
      fetchImpl: f as unknown as typeof fetch, agora: 0,
    });
    expect(t.expiresAt).toBe((3600 - 60) * 1000);
  });

  it("propaga a mensagem do provedor — é a única pista de registro mal configurado", async () => {
    const f = respostaOk(
      { error: "invalid_grant", error_description: "AADSTS50011: redirect URI não confere" },
      false, 400,
    );
    await expect(
      trocarCodigo({ provider: "microsoft", cfg: CFG, code: "c", redirectUri: "r", fetchImpl: f as unknown as typeof fetch }),
    ).rejects.toThrow(/redirect URI não confere/);
  });

  it("HTTP 200 sem access_token também é falha", async () => {
    const f = respostaOk({});
    await expect(
      trocarCodigo({ provider: "microsoft", cfg: CFG, code: "c", redirectUri: "r", fetchImpl: f as unknown as typeof fetch }),
    ).rejects.toThrow(/Falha ao obter token/);
  });
});

describe("renovar", () => {
  it("devolve o refresh_token NOVO quando o provedor rotaciona", async () => {
    // A Microsoft invalida o anterior. Guardar o antigo quebra a conexão na
    // renovação seguinte — e só se descobre horas depois.
    const f = respostaOk({ access_token: "at2", refresh_token: "rt2", expires_in: 3600 });
    const t = await renovar({
      provider: "microsoft", cfg: CFG, refreshToken: "rt1", fetchImpl: f as unknown as typeof fetch,
    });
    expect(t.refreshToken).toBe("rt2");
  });

  it("sem refresh_token novo, sinaliza null para o antigo ser preservado", async () => {
    const f = respostaOk({ access_token: "at2", expires_in: 3600 });
    const t = await renovar({
      provider: "google", cfg: CFG, refreshToken: "rt1", fetchImpl: f as unknown as typeof fetch,
    });
    expect(t.refreshToken).toBeNull();
  });

  it("manda scope na renovação — a Microsoft exige", async () => {
    const f = respostaOk({ access_token: "a", expires_in: 60 });
    await renovar({ provider: "microsoft", cfg: CFG, refreshToken: "r", fetchImpl: f as unknown as typeof fetch });
    const body = new URLSearchParams((f.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("scope")).toContain("Mail.Read");
  });
});

describe("precisaRenovar", () => {
  it("sem validade conhecida, renova", () => {
    expect(precisaRenovar(null)).toBe(true);
    expect(precisaRenovar(undefined)).toBe(true);
  });

  it("expirado renova; futuro não", () => {
    expect(precisaRenovar(1000, 2000)).toBe(true);
    expect(precisaRenovar(3000, 2000)).toBe(false);
  });

  it("no instante exato, renova — empate não pode virar chamada com token morto", () => {
    expect(precisaRenovar(2000, 2000)).toBe(true);
  });
});

describe("lerPerfil", () => {
  it("na Microsoft cai para userPrincipalName quando mail é nulo", async () => {
    const f = respostaOk({ displayName: "Igor", mail: null, userPrincipalName: "igor@natcorpbr.com" });
    expect(await lerPerfil("microsoft", "at", f as unknown as typeof fetch)).toEqual({
      email: "igor@natcorpbr.com", nome: "Igor",
    });
  });

  it("nunca derruba a conexão quando o perfil falha", async () => {
    const ruim = vi.fn().mockRejectedValue(new Error("rede"));
    expect(await lerPerfil("google", "at", ruim as unknown as typeof fetch)).toEqual({ email: null, nome: null });

    const naoOk = respostaOk({}, false, 403);
    expect(await lerPerfil("microsoft", "at", naoOk as unknown as typeof fetch)).toEqual({ email: null, nome: null });
  });
});
