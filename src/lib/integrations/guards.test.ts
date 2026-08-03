import { describe, it, expect } from "vitest";
import { runGuard, decisaoEscopoPessoa, type ConfirmDeps, type PendingRow } from "./guards";
import { invalidateOAuthToken } from "./oauth";
import type { RuntimeCredential } from "./executor";

describe("decisaoEscopoPessoa (escopo por painel)", () => {
  it("sem alvo ou alvo = o próprio → sempre ok (consulta os próprios dados)", () => {
    expect(decisaoEscopoPessoa("PC", "123", "")).toBe("ok");
    expect(decisaoEscopoPessoa("PC", "123", "123")).toBe("ok");
    expect(decisaoEscopoPessoa("", "123", " 123 ")).toBe("ok");
  });
  it("Operador (PO) consulta qualquer matrícula", () => {
    expect(decisaoEscopoPessoa("PO", "123", "999")).toBe("ok");
    expect(decisaoEscopoPessoa("po", "123", "999")).toBe("ok");
  });
  it("Gestor (PG) exige checagem de equipe", () => {
    expect(decisaoEscopoPessoa("PG", "123", "999")).toBe("equipe");
  });
  it("Colaborador (PC) nega consultar outro", () => {
    expect(decisaoEscopoPessoa("PC", "123", "999")).toBe("nega");
  });
  it("painel desconhecido nega consultar outro (seguro por padrão)", () => {
    expect(decisaoEscopoPessoa("", "123", "999")).toBe("nega");
    expect(decisaoEscopoPessoa("XX", "123", "999")).toBe("nega");
  });
});

/** Store + entrega em memória para o guard de confirmação (sem DB, sem e-mail). */
function fakeConfirm(over: Partial<ConfirmDeps> = {}) {
  const rows: (PendingRow & { subject: string; action: string })[] = [];
  const sent: { to: string; code: string }[] = [];
  const state = { time: 1000 };
  const deps: ConfirmDeps = {
    findPending: async (subject, action) => rows.filter((r) => r.subject === subject && r.action === action && !r.used_at),
    createPending: async (row) => {
      rows.push({ id: `id${rows.length}`, used_at: null, ...row });
    },
    markUsed: async (id) => {
      const r = rows.find((x) => x.id === id);
      if (r) r.used_at = state.time;
    },
    emailFor: async () => "user@x.com",
    deliver: async (to, code) => {
      sent.push({ to, code });
      return true;
    },
    genCode: () => "123456",
    now: () => state.time,
    ...over,
  };
  return { deps, rows, sent, state };
}
const idn = { usuario: "365785", matricula: "365785" };

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) } as unknown as Response;
}
const cred = (id: string): RuntimeCredential => ({
  id,
  auth_type: "oauth2",
  secret: { token_url: "https://erp.test/token", client_id: "c", client_secret: "s", session_key: "SK" },
});
const team = (matriculas: number[]) =>
  (async (url: string) => {
    if (url.includes("/token")) return jsonResponse(200, { access_token: "T", expires_in: 3600 });
    if (url.includes("colaboradores_resumo")) return jsonResponse(200, { items: matriculas.map((m) => ({ matricula: m })) });
    return jsonResponse(404, {});
  }) as unknown as typeof fetch;

describe("guard team_membership", () => {
  it("permite matrícula que está na equipe do gestor", async () => {
    invalidateOAuthToken("g1");
    const r = await runGuard("team_membership", {
      baseUrl: "https://x",
      credential: cred("g1"),
      identity: { usuario: "365785", perfil: "gestor" },
      modelArgs: { matricula: "345" },
      fetchImpl: team([345, 41394]),
    });
    expect(r.ok).toBe(true);
  });

  it("recusa matrícula FORA da equipe", async () => {
    invalidateOAuthToken("g2");
    const r = await runGuard("team_membership", {
      baseUrl: "https://x",
      credential: cred("g2"),
      identity: { usuario: "365785", perfil: "gestor" },
      modelArgs: { matricula: "999999" },
      fetchImpl: team([345]),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/equipe/i);
  });

  it("guard desconhecido bloqueia (falha fechada)", async () => {
    const r = await runGuard("nao_existe", { baseUrl: "https://x", credential: cred("g3"), identity: {}, modelArgs: {} });
    expect(r.ok).toBe(false);
  });

  it("sem session_key/usuário recusa", async () => {
    const r = await runGuard("team_membership", {
      baseUrl: "https://x",
      credential: { id: "g4", auth_type: "oauth2", secret: {} },
      identity: { usuario: "1" },
      modelArgs: { matricula: "1" },
    });
    expect(r.ok).toBe(false);
  });
});

describe("guard saque_confirmation (confirmação fora-da-banda)", () => {
  const base = (confirm: ConfirmDeps, modelArgs: Record<string, unknown>) => ({
    baseUrl: "x",
    baseCode: "natcorp",
    credential: null,
    identity: idn,
    modelArgs,
    confirm,
  });

  it("sem código emite+envia+recusa; código certo efetiva; reuso recusa", async () => {
    const f = fakeConfirm();
    const r1 = await runGuard("saque_confirmation", base(f.deps, { valor: "200" }));
    expect(r1.ok).toBe(false);
    expect(f.rows.length).toBe(1);
    expect(f.sent).toEqual([{ to: "user@x.com", code: "123456" }]);

    const r2 = await runGuard("saque_confirmation", base(f.deps, { valor: "200", codigo: "123456" }));
    expect(r2.ok).toBe(true);

    const r3 = await runGuard("saque_confirmation", base(f.deps, { valor: "200", codigo: "123456" }));
    expect(r3.ok).toBe(false); // já usado
  });

  it("código errado recusa", async () => {
    const f = fakeConfirm();
    await runGuard("saque_confirmation", base(f.deps, { valor: "200" }));
    const r = await runGuard("saque_confirmation", base(f.deps, { valor: "200", codigo: "000000" }));
    expect(r.ok).toBe(false);
  });

  it("código expirado recusa", async () => {
    const f = fakeConfirm();
    await runGuard("saque_confirmation", base(f.deps, { valor: "200" }));
    f.state.time = 999_999_999;
    const r = await runGuard("saque_confirmation", base(f.deps, { valor: "200", codigo: "123456" }));
    expect(r.ok).toBe(false);
  });

  it("sem e-mail cadastrado recusa e não emite", async () => {
    const f = fakeConfirm({ emailFor: async () => null });
    const r = await runGuard("saque_confirmation", base(f.deps, { valor: "200" }));
    expect(r.ok).toBe(false);
    expect(f.rows.length).toBe(0);
  });

  it("sem deps de confirmação recusa (falha fechada)", async () => {
    const r = await runGuard("saque_confirmation", {
      baseUrl: "x",
      credential: null,
      identity: idn,
      modelArgs: {},
    });
    expect(r.ok).toBe(false);
  });
});
