import { describe, it, expect } from "vitest";
import { runGuard, decisaoEscopoPessoa, ehAfirmacao, type ConfirmDeps, type PendingRow } from "./guards";
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

/** Store em memória para o guard de confirmação IN-CHAT (sem DB, sem e-mail). */
function fakeConfirm(over: Partial<ConfirmDeps> = {}) {
  const rows: (PendingRow & { subject: string; action: string; tool_key?: string })[] = [];
  const state = { time: 1000 };
  const deps: ConfirmDeps = {
    findPending: async (subject, action) => rows.filter((r) => r.subject === subject && r.action === action && !r.used_at),
    createPending: async (row) => {
      rows.push({ id: `id${rows.length}`, used_at: null, confirmed_at: null, subject: row.subject, action: row.action, tool_key: row.toolKey, expires_at: row.expires_at });
    },
    markUsed: async (id) => {
      const r = rows.find((x) => x.id === id);
      if (r) r.used_at = state.time;
    },
    now: () => state.time,
    ...over,
  };
  /** Simula a ROTA marcando confirmada a pendência mais recente do subject (o "sim"). */
  const confirmar = (subject: string) => {
    const p = [...rows].reverse().find((r) => r.subject === subject && !r.used_at && r.confirmed_at == null);
    if (p) p.confirmed_at = state.time;
  };
  return { deps, rows, state, confirmar };
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

describe("guard saque_confirmation (confirmação in-chat)", () => {
  const base = (confirm: ConfirmDeps, modelArgs: Record<string, unknown>) => ({
    baseUrl: "x",
    baseCode: "natcorp",
    credential: null,
    identity: idn,
    modelArgs,
    confirm,
    toolKey: "registrar_saque",
  });

  it("cria pendência e recusa; após o 'sim' (rota) efetiva; reuso recria", async () => {
    const f = fakeConfirm();
    const r1 = await runGuard("saque_confirmation", base(f.deps, { valor: "200" }));
    expect(r1.ok).toBe(false);
    expect(f.rows.length).toBe(1);
    expect(f.rows[0]!.confirmed_at).toBeNull();
    expect(f.rows[0]!.tool_key).toBe("registrar_saque");

    // IA re-chama antes do "sim" → ainda recusa, SEM criar outra pendência.
    const r1b = await runGuard("saque_confirmation", base(f.deps, { valor: "200" }));
    expect(r1b.ok).toBe(false);
    expect(f.rows.length).toBe(1);

    // A ROTA marca confirmada (usuário disse "sim").
    f.confirmar(`${idn.usuario}:${idn.matricula}`);
    const r2 = await runGuard("saque_confirmation", base(f.deps, { valor: "200" }));
    expect(r2.ok).toBe(true);

    // Já usada → nova tentativa recria pendência (novo saque exige nova confirmação).
    const r3 = await runGuard("saque_confirmation", base(f.deps, { valor: "200" }));
    expect(r3.ok).toBe(false);
    expect(f.rows.length).toBe(2);
  });

  it("confirmada mas EXPIRADA não efetiva", async () => {
    const f = fakeConfirm();
    await runGuard("saque_confirmation", base(f.deps, { valor: "200" }));
    f.confirmar(`${idn.usuario}:${idn.matricula}`);
    f.state.time = 999_999_999; // passou dos 10 min
    const r = await runGuard("saque_confirmation", base(f.deps, { valor: "200" }));
    expect(r.ok).toBe(false);
  });

  it("sem deps de confirmação recusa (falha fechada)", async () => {
    const r = await runGuard("saque_confirmation", { baseUrl: "x", credential: null, identity: idn, modelArgs: {} });
    expect(r.ok).toBe(false);
  });
});

describe("guard confirmation (genérico, in-chat, namespaceado por ferramenta)", () => {
  const base = (confirm: ConfirmDeps, toolKey: string) => ({
    baseUrl: "x",
    credential: null,
    identity: idn,
    modelArgs: {},
    confirm,
    toolKey,
    actionLabel: "Atualizar dados",
  });

  it("cria pendência (com tool_key) e recusa; após o 'sim' efetiva", async () => {
    const f = fakeConfirm();
    const r1 = await runGuard("confirmation", base(f.deps, "atualizar_dados"));
    expect(r1.ok).toBe(false);
    expect(f.rows[0]!.tool_key).toBe("atualizar_dados");
    f.confirmar(`${idn.usuario}:${idn.matricula}`);
    const r2 = await runGuard("confirmation", base(f.deps, "atualizar_dados"));
    expect(r2.ok).toBe(true);
  });

  it("confirmar UMA ferramenta NÃO libera OUTRA (namespace por action)", async () => {
    const f = fakeConfirm();
    await runGuard("confirmation", base(f.deps, "ferramenta_a"));
    f.confirmar(`${idn.usuario}:${idn.matricula}`); // marca a de A
    const r = await runGuard("confirmation", base(f.deps, "ferramenta_b"));
    expect(r.ok).toBe(false);
  });
});

describe("ehAfirmacao", () => {
  it("reconhece afirmações no início da mensagem", () => {
    for (const m of ["sim", "Sim", "sim, pode", "confirmo", "confirmar", "pode", "ok", "isso", "autorizo", "com certeza"])
      expect(ehAfirmacao(m)).toBe(true);
  });
  it("rejeita negações e frases não-afirmativas", () => {
    for (const m of ["não", "nao quero", "espera", "qual o valor?", "", "cancela", "prefiro não"])
      expect(ehAfirmacao(m)).toBe(false);
  });
});
