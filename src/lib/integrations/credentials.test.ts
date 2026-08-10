import { describe, expect, it } from "vitest";
import { AUTH_TYPES, CREDENTIAL_FIELDS, metaKeys, requiredKeys, type AuthType, separarCampos, chavesSecretas } from "./credentials";

describe("requiredKeys", () => {
  it("NÃO cobra os campos `meta` — eles não moram no blob cifrado", () => {
    // O defeito real: `provider` é obrigatório e é `meta`. A ação o retira do
    // blob antes de cifrar; se `requiredKeys` continuasse cobrando, a tela
    // pediria para preencher um campo que já estava preenchido, e não havia
    // como o usuário sair desse laço.
    expect(requiredKeys("oauth2_user")).not.toContain("provider");
    expect(metaKeys("oauth2_user")).toContain("provider");
  });

  it("continua cobrando o que é segredo de verdade", () => {
    expect(requiredKeys("oauth2_user")).toEqual(
      expect.arrayContaining(["client_id", "client_secret"]),
    );
  });

  it("não muda o comportamento dos tipos que já existiam", () => {
    expect(requiredKeys("oauth2")).toEqual(["token_url", "client_id", "client_secret"]);
    expect(requiredKeys("basic")).toEqual(["username", "password"]);
    expect(requiredKeys("bearer")).toEqual(["token"]);
    expect(requiredKeys("none")).toEqual([]);
    for (const t of ["oauth2", "basic", "bearer", "api_key", "none"] as const) {
      expect(metaKeys(t)).toEqual([]);
    }
  });
});

describe("catálogo de tipos", () => {
  it("todo tipo listado na tela tem definição de campos", () => {
    for (const a of AUTH_TYPES) {
      expect(CREDENTIAL_FIELDS[a.value], `sem campos para ${a.value}`).toBeDefined();
    }
  });

  it("todo campo obrigatório é preenchível — ou é lista, ou é livre", () => {
    for (const [tipo, campos] of Object.entries(CREDENTIAL_FIELDS)) {
      for (const f of campos) {
        if (!f.options) continue;
        expect(f.options.length, `${tipo}.${f.key} é lista sem opções`).toBeGreaterThan(0);
        for (const o of f.options) {
          // Valor de lista tem de ser exatamente o que o motor compara. Um
          // rótulo indo como valor ("Microsoft" em vez de "microsoft") só
          // falharia lá na frente, na hora de conectar.
          expect(o.value).toBe(o.value.trim().toLowerCase());
        }
      }
    }
  });

  it("o provedor delegado oferece só o que o motor entende", () => {
    const provider = CREDENTIAL_FIELDS.oauth2_user.find((f) => f.key === "provider");
    expect(provider?.options?.map((o) => o.value)).toEqual(["microsoft", "google"]);
  });

  it("campo de segredo nunca é lista — senão o valor apareceria na tela", () => {
    for (const campos of Object.values(CREDENTIAL_FIELDS)) {
      for (const f of campos) {
        if (f.secret) expect(f.options).toBeUndefined();
      }
    }
  });
});

describe("separarCampos", () => {
  it("configuração volta para a tela; segredo fica de fora", () => {
    const { config, segredo } = separarCampos("oauth2", {
      token_url: "https://x/oauth/token",
      client_id: "abc",
      client_secret: "s3cr3t",
      scope: "read",
    });
    expect(config).toEqual({ token_url: "https://x/oauth/token", client_id: "abc", scope: "read" });
    expect(segredo).toEqual({ client_secret: "s3cr3t" });
  });

  it("chave DESCONHECIDA cai em segredo", () => {
    // Campo de um tipo antigo ou renomeado: na dúvida entre expor e esconder,
    // esconder é o erro barato.
    const { config, segredo } = separarCampos("oauth2", { campo_de_outra_era: "xyz" });
    expect(config).toEqual({});
    expect(segredo).toEqual({ campo_de_outra_era: "xyz" });
  });

  it("session_key é segredo mesmo sendo opcional", () => {
    const { segredo } = separarCampos("oauth2", { session_key: "k" });
    expect(segredo).toEqual({ session_key: "k" });
  });

  it("ignora valores que não são texto ou número", () => {
    const { config, segredo } = separarCampos("oauth2", {
      client_id: "abc",
      lixo: { a: 1 },
      nulo: null,
    });
    expect(config).toEqual({ client_id: "abc" });
    expect(segredo).toEqual({});
  });

  it("blob vazio não quebra", () => {
    expect(separarCampos("basic", {})).toEqual({ config: {}, segredo: {} });
  });
});

describe("chavesSecretas", () => {
  it("lista só o que a tela deve mascarar", () => {
    expect(chavesSecretas("oauth2").sort()).toEqual(["client_secret", "session_key"]);
  });

  it("tipo sem segredo devolve vazio", () => {
    expect(chavesSecretas("none")).toEqual([]);
  });
});
