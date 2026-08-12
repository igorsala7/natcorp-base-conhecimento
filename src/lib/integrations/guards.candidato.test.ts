import { describe, it, expect, vi } from "vitest";
import { runGuard } from "./guards";

const base = {
  baseUrl: "https://api",
  credential: { id: "c1", auth_type: "oauth2" as const, secret: { session_key: "k", client_id: "i", client_secret: "s", token_url: "https://auth/oauth/token" } },
  modelArgs: {},
};

/** A ferramenta é a mesma para o RH e para o candidato — muda quem pergunta. */
describe("guard processo_do_candidato", () => {
  it("quem tem matrícula passa pelo escopo do painel, não pela regra do candidato", async () => {
    // Operador (PO): sem esta passagem, marcar o guard na ferramenta quebraria
    // a consulta de requisições para o RH inteiro.
    const r = await runGuard("processo_do_candidato", {
      ...base,
      identity: { matricula: "365785", portal: "PO", perfil: "MASTER" },
      panelScope: "todos",
    });
    expect(r.ok).toBe(true);
  });

  it("candidato sem informar a requisição é recusado, com o caminho na mensagem", async () => {
    const r = await runGuard("processo_do_candidato", {
      ...base,
      identity: { cod_candidato: "8814", portal: "PC" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/candidatos selecionados/i);
  });

  it("candidato pedindo requisição que não é do processo dele é bloqueado", async () => {
    const fetchImpl = vi.fn(async (url: string) =>
      url.includes("oauth") || url.includes("token")
        ? ({ ok: true, status: 200, json: async () => ({ access_token: "t", expires_in: 3600 }) } as unknown as Response)
        : ({ ok: true, status: 200, json: async () => ({ items: [{ cod_vaga: "111" }] }) } as unknown as Response),
    );
    const r = await runGuard("processo_do_candidato", {
      ...base,
      credential: { ...base.credential, id: "c-bloqueia" },
      identity: { cod_candidato: "8814" },
      modelArgs: { requisicao: "999" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/seu próprio processo/i);
  });

  it("candidato pedindo a requisição do processo dele passa", async () => {
    const fetchImpl = vi.fn(async (url: string) =>
      url.includes("oauth") || url.includes("token")
        ? ({ ok: true, status: 200, json: async () => ({ access_token: "t", expires_in: 3600 }) } as unknown as Response)
        : ({ ok: true, status: 200, json: async () => ({ items: [{ cod_vaga: "999" }] }) } as unknown as Response),
    );
    const r = await runGuard("processo_do_candidato", {
      ...base,
      credential: { ...base.credential, id: "c-libera" },
      identity: { cod_candidato: "8815" },
      modelArgs: { requisicao: "999" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r.ok).toBe(true);
  });
});
