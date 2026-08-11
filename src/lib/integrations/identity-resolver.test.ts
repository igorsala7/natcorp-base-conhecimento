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
  it("valida, injeta CPF e PRESERVA o perfil do token (gestor de CC não é perfil)", async () => {
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
      identity: { cod_empresa: "700", matricula: "365785", usuario: "365785", perfil: "MASTER" },
      fetchImpl: fetchMock,
    });

    expect(res.ok).toBe(true);
    expect(res.identity.cpf).toBe("070.386.368-12");
    // O cadastro diz gestor:"SIM" (responde por um centro de custo). Isso NÃO é o
    // perfil da pessoa — o perfil é o que o portal mandou no token e continua valendo.
    expect(res.identity.perfil).toBe("MASTER");
    expect(res.profile?.gestorDeEquipe).toBe(true);
    expect(res.profile?.perfil).toBe("MASTER");
    expect(res.profile?.nome).toBe("FERNANDO MATTOS TORRES");
    expect(res.profile?.cargo).toBe("ANALISTA");
    // A query do perfil leva a key de sessão e empresa/matrícula.
    const profCall = (fetchMock as unknown as { mock: { calls: string[][] } }).mock.calls.find((c) =>
      String(c[0]).includes("dados_colab_usuario"),
    );
    expect(String(profCall?.[0])).toContain("key=SK");
    expect(String(profCall?.[0])).toContain("matricula=365785");
  });

  it("sem perfil no token, o login NÃO inventa um", async () => {
    invalidateOAuthToken("r5");
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/token")) return jsonResponse(200, { access_token: "T", expires_in: 3600 });
      if (url.includes("/autenticacao")) return jsonResponse(200, [{ status: "OK" }]);
      if (url.includes("/dados_colab_usuario"))
        return jsonResponse(200, { items: [{ cpf: "1", gestor: "NAO", nome: "FULANO" }], count: 1 });
      return jsonResponse(404, {});
    }) as unknown as typeof fetch;

    const res = await resolveIdentity({
      baseUrl: "https://x/apex/rh/natcorp/",
      credential: cred("r5", "SK"),
      identity: { cod_empresa: "700", matricula: "1", usuario: "1" },
      fetchImpl: fetchMock,
    });
    expect(res.identity.perfil).toBeUndefined();
    expect(res.profile?.gestorDeEquipe).toBe(false);
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

describe("motivo carrega o STATUS da falha", () => {
  const cred = { id: "c1", secret: { session_key: "k", client_id: "i", client_secret: "s", token_url: "https://t/tok" } };
  const identity = { cod_empresa: "1", matricula: "57292", usuario: "PORTAL" };
  // `text()` alem de `json()`: o rastro do token le o corpo tambem no sucesso.
  const tokenOk = {
    ok: true,
    status: 200,
    json: async () => ({ access_token: "at", expires_in: 3600 }),
    text: async () => JSON.stringify({ access_token: "at", expires_in: 3600 }),
  } as Response;
  // O resolver agora le o CORPO sempre (e onde vinha o ORA- do caso real),
  // entao o mock precisa de `text()` alem de `json()`.
  const resp = (status: number, corpo: string) =>
    ({ ok: status >= 200 && status < 300, status, text: async () => corpo }) as Response;

  // Id NOVO a cada chamada: o resolver guarda o resultado em cache por
  // credencial+matrícula (inclusive as falhas, com TTL curto), então reusar o
  // mesmo id faria o segundo caso ler a resposta do primeiro.
  let seq = 0;
  const resolver = async (loginRes: Partial<Response>) => {
    let n = 0;
    const f = (async () => (n++ === 0 ? tokenOk : loginRes)) as unknown as typeof fetch;
    const mod = await import("./identity-resolver");
    return mod.resolveIdentity({
      baseUrl: "https://b",
      credential: { ...cred, id: `c${++seq}` } as never,
      identity,
      fetchImpl: f,
    });
  };

  it("555 (handler do cliente quebrado) aparece no motivo", async () => {
    // O caso real da Stefanini: o PL/SQL do /autenticacao nao compila por
    // tabela ausente. Sem o status, isso era indistinguivel de "usuario nao
    // encontrado" — e mandaria procurar o defeito no lugar errado.
    const r = await resolver(resp(555, "<html><pre>ORA-00942: a tabela ou view nao existe</pre></html>"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toBe("sem_resposta_login:http_555");
  });

  it("404 (endpoint inexistente) se distingue de 401 (chave recusada)", async () => {
    const r404 = await resolver(resp(404, "Not Found"));
    const r401 = await resolver(resp(401, "Unauthorized"));
    if (!r404.ok) expect(r404.motivo).toBe("sem_resposta_login:http_404");
    if (!r401.ok) expect(r401.motivo).toBe("sem_resposta_login:http_401");
  });

  it("200 com lista vazia é 'vazio' — o unico caso normal dos quatro", async () => {
    const r = await resolver(resp(200, JSON.stringify({ items: [] })));
    if (!r.ok) expect(r.motivo).toBe("sem_resposta_login:vazio");
  });
  it("a CHAMADA volta com curl e o ORA- da resposta", async () => {
    // O objetivo da rodada: reproduzir a falha sem decifrar credencial do banco.
    const r = await resolver(resp(555, "<html><style>body{margin:0}</style><pre>ORA-00942: a tabela ou view nao existe</pre></html>"));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.chamada?.status).toBe(555);
      expect(r.chamada?.resposta).toContain("ORA-00942");
      expect(r.chamada?.resposta).not.toContain("margin");
      expect(r.chamada?.curl).toContain("curl -i -X POST");
      // Chave de sessao e token NUNCA aparecem no comando.
      expect(r.chamada?.curl).not.toContain("session");
      expect(r.chamada?.curl).toContain("Bearer ***");
    }
  });
});

describe("todas as chamadas viram rastro", () => {
  const cred = { id: "cx", secret: { session_key: "chave-de-sessao-longa", client_id: "i", client_secret: "segredo-bem-longo-aqui", token_url: "https://t/tok" } };
  const identity = { cod_empresa: "1", matricula: "57292", usuario: "PORTAL" };

  it("token + autenticacao + perfil, na ordem", async () => {
    // Uma falha pode estar em qualquer uma das tres, com correcoes diferentes.
    // Guardar so a que falhou esconderia que as anteriores passaram.
    let n = 0;
    const f = (async () => {
      n++;
      if (n === 1) return { ok: true, status: 200, text: async () => JSON.stringify({ access_token: "at", expires_in: 3600 }) } as Response;
      if (n === 2) return { ok: true, status: 200, text: async () => JSON.stringify([{ status: "OK" }]) } as Response;
      return { ok: true, status: 200, text: async () => JSON.stringify([{ nome: "Fulano", cpf: "123" }]) } as Response;
    }) as unknown as typeof fetch;
    const mod = await import("./identity-resolver");
    const r = await mod.resolveIdentity({ baseUrl: "https://b", credential: cred as never, identity, fetchImpl: f });
    expect(r.ok).toBe(true);
    expect(r.chamadas?.map((c) => c.etapa)).toEqual([
      "oauth/token (body)",
      "login/autenticacao",
      "login/dados_colab_usuario",
    ]);
  });

  it("o corpo do PERFIL nao vai para o log quando da certo", async () => {
    // Sao dados pessoais (CPF, cargo, e-mail) e o log e lido por quem
    // administra, nao por quem tem direito a ve-los.
    let n = 0;
    const f = (async () => {
      n++;
      if (n === 1) return { ok: true, status: 200, text: async () => JSON.stringify({ access_token: "at" }) } as Response;
      if (n === 2) return { ok: true, status: 200, text: async () => JSON.stringify([{ status: "OK" }]) } as Response;
      return { ok: true, status: 200, text: async () => JSON.stringify([{ nome: "Fulano", cpf: "99988877766" }]) } as Response;
    }) as unknown as typeof fetch;
    const mod = await import("./identity-resolver");
    const r = await mod.resolveIdentity({ baseUrl: "https://b", credential: { ...cred, id: "cy" } as never, identity, fetchImpl: f });
    const perfil = r.chamadas?.find((c) => c.etapa === "login/dados_colab_usuario");
    expect(perfil?.status).toBe(200);
    expect(perfil?.resposta).toBe("");
    expect(JSON.stringify(r.chamadas)).not.toContain("99988877766");
  });

  it("a chave de sessao nunca aparece no curl", async () => {
    let n = 0;
    const f = (async () => {
      n++;
      if (n === 1) return { ok: true, status: 200, text: async () => JSON.stringify({ access_token: "at" }) } as Response;
      return { ok: false, status: 555, text: async () => "<pre>ORA-00942</pre>" } as Response;
    }) as unknown as typeof fetch;
    const mod = await import("./identity-resolver");
    const r = await mod.resolveIdentity({ baseUrl: "https://b", credential: { ...cred, id: "cz" } as never, identity, fetchImpl: f });
    expect(JSON.stringify(r.chamadas)).not.toContain("chave-de-sessao-longa");
    expect(JSON.stringify(r.chamadas)).not.toContain("segredo-bem-longo-aqui");
    expect(r.chamadas?.at(-1)?.resposta).toContain("ORA-00942");
  });
});
