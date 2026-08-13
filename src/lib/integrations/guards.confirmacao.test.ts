import { describe, expect, it } from "vitest";
import { runGuard, type ConfirmDeps, type GuardContext, type PendingRow } from "./guards";

/**
 * O que estes testes protegem: a confirmação é a ÚNICA barreira entre "um
 * documento da base de conhecimento pediu" e "um e-mail saiu em nome da
 * pessoa". Uma regressão aqui não quebra nada visivelmente — só deixa de
 * proteger.
 */
function deps() {
  const linhas: (PendingRow & { subject: string; action: string; detail: string; args?: Record<string, unknown> })[] = [];
  let seq = 0;
  const d: ConfirmDeps & { linhas: typeof linhas } = {
    linhas,
    findPending: async (subject, action) =>
      linhas.filter((l) => l.subject === subject && l.action === action),
    createPending: async (row) => {
      linhas.push({
        id: `p${++seq}`, subject: row.subject, action: row.action, detail: row.detail,
        args: row.args, expires_at: row.expires_at, used_at: null, confirmed_at: null,
      });
    },
    markUsed: async (id) => {
      const l = linhas.find((x) => x.id === id);
      if (l) l.used_at = Date.now();
    },
    now: () => 1_000_000,
  };
  return d;
}

const ctx = (modelArgs: Record<string, unknown>, d: ConfirmDeps): GuardContext => ({
  baseUrl: "https://graph.microsoft.com/v1.0",
  credential: null,
  identity: { usuario: "igor", matricula: "1" },
  modelArgs,
  confirm: d,
  toolKey: "ms_email_enviar",
  actionLabel: "enviar e-mail",
});

const EMAIL_A = { para: "diretoria@empresa.com", assunto: "Demissão", corpo: "Comunico meu desligamento." };
const EMAIL_B = { para: "outro@empresa.com", assunto: "Demissão", corpo: "Comunico meu desligamento." };

describe("confirmation_detalhada", () => {
  it("recusa na primeira vez e manda perguntar mostrando o CONTEÚDO", async () => {
    const d = deps();
    const r = await runGuard("confirmation_detalhada", ctx(EMAIL_A, d));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    // O destinatário e o assunto precisam aparecer na pergunta: é o que a
    // pessoa lê antes de dizer sim.
    expect(r.erro).toContain("diretoria@empresa.com");
    expect(r.erro).toContain("Demissão");
    expect(r.erro).toMatch(/NÃO execute ainda/);
  });

  it("libera depois que o usuário confirma", async () => {
    const d = deps();
    await runGuard("confirmation_detalhada", ctx(EMAIL_A, d));
    d.linhas[0]!.confirmed_at = d.now(); // a ROTA marca, não a IA
    expect((await runGuard("confirmation_detalhada", ctx(EMAIL_A, d))).ok).toBe(true);
  });

  it("um 'sim' NÃO autoriza um destinatário diferente", async () => {
    // O buraco do guard genérico: ele nomeia a pendência só por ferramenta,
    // então a confirmação de um e-mail liberaria qualquer outro nos 10 minutos
    // seguintes — inclusive um que o modelo montasse depois.
    const d = deps();
    await runGuard("confirmation_detalhada", ctx(EMAIL_A, d));
    d.linhas[0]!.confirmed_at = d.now();

    const outro = await runGuard("confirmation_detalhada", ctx(EMAIL_B, d));
    expect(outro.ok).toBe(false);
    if (!outro.ok) expect(outro.erro).toContain("outro@empresa.com");
  });

  it("o guard genérico TEM esse buraco — é por isso que a escrita não o usa", async () => {
    const d = deps();
    await runGuard("confirmation", ctx(EMAIL_A, d));
    d.linhas[0]!.confirmed_at = d.now();
    // Mesma ferramenta, conteúdo completamente diferente: passa.
    expect((await runGuard("confirmation", ctx(EMAIL_B, d))).ok).toBe(true);
  });

  it("não reaproveita uma confirmação já usada", async () => {
    const d = deps();
    await runGuard("confirmation_detalhada", ctx(EMAIL_A, d));
    d.linhas[0]!.confirmed_at = d.now();
    expect((await runGuard("confirmation_detalhada", ctx(EMAIL_A, d))).ok).toBe(true);
    // A segunda tentativa com o mesmo conteúdo tem de pedir de novo.
    expect((await runGuard("confirmation_detalhada", ctx(EMAIL_A, d))).ok).toBe(false);
  });

  it("pendência expirada não libera", async () => {
    const d = deps();
    await runGuard("confirmation_detalhada", ctx(EMAIL_A, d));
    d.linhas[0]!.confirmed_at = d.now();
    d.linhas[0]!.expires_at = d.now() - 1;
    expect((await runGuard("confirmation_detalhada", ctx(EMAIL_A, d))).ok).toBe(false);
  });

  it("guard desconhecido bloqueia — falha FECHADA", async () => {
    const d = deps();
    expect((await runGuard("confirmacao_inventada", ctx(EMAIL_A, d))).ok).toBe(false);
  });
});
