/**
 * O PORTÃO DO MODO SUPORTE, sob teste.
 *
 * `abrirSessaoGestao({ suporte: "1", ... })` é a porta que a EQUIPE INTERNA usa
 * para abrir a gestão de QUALQUER cliente (`/admin/gestao?suporte=1&base=X`).
 * Ela não tem token de cliente para validar — quem autoriza é `hasPermission
 * ("gestao.suporte")`, e só isso. Se essa checagem falhar aberta, qualquer
 * pessoa autenticada no admin (mesmo sem a permissão) abriria a gestão de
 * qualquer base do sistema, como se fosse o próprio cliente.
 *
 * ── Por que este teste não existia ────────────────────────────────────────
 * `sessaoSchema` (`src/lib/gestao/acao.ts`) nem aceita um campo "modo" — o
 * cliente não tem como REIVINDICAR suporte pelo formulário, então esse vetor
 * está fechado por estrutura. Mas os testes de `actions.ts` dublam
 * `abrirSessaoGestao` INTEIRO (`vi.mock("@/lib/gestao/sessao", ...)`), o que é
 * certo para testar a AÇÃO — e significa que o portão em si, aqui dentro,
 * nunca foi exercitado por teste nenhum. Este arquivo é esse teste, e é o
 * único dos quatro cenários de requisição forjada (ver auditoria da tarefa 14)
 * sem regressão pinada.
 *
 * ── O que é dublado, e o que NÃO é ────────────────────────────────────────
 * `hasPermission` (`@/lib/auth/permissions`) roda de VERDADE — é a função que
 * decide a autorização, e dublá-la apagaria justamente o portão que este
 * arquivo afirma. O que se dubla é só a FRONTEIRA: `@/lib/supabase/server`
 * (de onde `hasPermission` lê usuário e RPC) e `@/lib/supabase/admin` (de onde
 * `sessaoDeSuporte` lê `ai_bases`) — para o teste não bater num banco real e
 * para poder AFIRMAR que a leitura de base não aconteceu quando a permissão
 * falta.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { abrirSessaoGestao } from "./sessao";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** O cliente Supabase (chave anon) que `hasPermission` consome. */
function dublarSupabaseServer(opcoes: { permitido: boolean }) {
  const rpc = vi.fn().mockResolvedValue({ data: opcoes.permitido, error: null });
  const getUser = vi.fn().mockResolvedValue({
    data: { user: { id: "user-tecnico-1", email: "tecnico@natcorp.com.br" } },
  });
  return { client: { auth: { getUser }, rpc }, rpc, getUser };
}

/** O cliente Supabase (`service_role`) que lê `ai_bases`. */
function dublarSupabaseAdmin() {
  return {
    from: (tabela: string) => {
      if (tabela !== "ai_bases") throw new Error(`tabela inesperada: ${tabela}`);
      return {
        select: () => ({
          ilike: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data: { id: "base-uuid-1", base_code: "acme", name: "ACME Ltda", active: true },
                error: null,
              }),
          }),
        }),
      };
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("modo suporte: o portão é a permissão, não o formulário", () => {
  it("SEM a permissão gestao.suporte, a sessão é RECUSADA antes de qualquer leitura de base", async () => {
    const { client, rpc } = dublarSupabaseServer({ permitido: false });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const r = await abrirSessaoGestao({ suporte: "1", base: "acme" });

    expect(r.ok).toBe(false);
    expect(!r.ok && r.motivo).toBe("sem_permissao");
    // A checagem foi feita — e com a chave certa — mas negou.
    expect(rpc).toHaveBeenCalledWith(
      "has_permission",
      expect.objectContaining({ p_permission_key: "gestao.suporte" }),
    );
    // NENHUMA leitura de base: `ai_bases` nunca chega a ser consultada quando
    // a permissão falta. Sem isto, uma requisição direta a
    // `/gestao?suporte=1&base=X` revelaria ao menos se a base existe.
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("COM a permissão, a sessão é aceita e `identidade.usuario` vem NULO — não se passa por ninguém", async () => {
    const { client } = dublarSupabaseServer({ permitido: true });
    vi.mocked(createClient).mockResolvedValue(client as never);
    vi.mocked(createAdminClient).mockReturnValue(dublarSupabaseAdmin() as never);

    const r = await abrirSessaoGestao({ suporte: "1", base: "acme" });

    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("esperado ok:true");
    expect(r.modo).toBe("suporte");
    expect(r.identidade.baseCode).toBe("acme");
    expect(r.identidade.baseId).toBe("base-uuid-1");
    // O suporte NÃO se passa por ninguém: sem usuário, sem perfil, sem painel.
    // Reproduzir a tela de um usuário específico seria impersonação.
    expect(r.identidade.usuario).toBeNull();
    expect(r.identidade.perfil).toBeNull();
    expect(r.identidade.painel).toBeNull();
    // Quem fica registrado como operador é o usuário INTERNO de verdade —
    // é o que faz `audit_log.actor_id` e `autorDa()` dizerem a verdade.
    expect(r.operador).toEqual({ id: "user-tecnico-1", email: "tecnico@natcorp.com.br" });
  });

  it("sem `base` na querystring, recusa ANTES até de checar a permissão", async () => {
    const { client, rpc } = dublarSupabaseServer({ permitido: true });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const r = await abrirSessaoGestao({ suporte: "1" });

    expect(r.ok).toBe(false);
    expect(!r.ok && r.motivo).toBe("base_nao_informada");
    expect(rpc).not.toHaveBeenCalled();
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});
