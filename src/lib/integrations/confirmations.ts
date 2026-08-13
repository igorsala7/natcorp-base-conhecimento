import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ConfirmDeps, PendingRow } from "./guards";

/**
 * Deps REAIS do guard de confirmação IN-CHAT: guardam/lêem a pendência em
 * `ai_pending_confirmations`. A liberação (`confirmed_at`) é feita pela ROTA do chat
 * quando o usuário responde "sim" (ver `confirmarPendencia`), nunca pela IA.
 */
export function buildConfirmDeps(baseCode: string): ConfirmDeps {
  const db = createAdminClient();
  return {
    findPending: async (subject, action) => {
      const { data } = await db
        .from("ai_pending_confirmations")
        .select("id, expires_at, used_at, confirmed_at")
        .eq("base_code", baseCode)
        .eq("subject", subject)
        .eq("action", action)
        .is("used_at", null);
      return (data ?? []).map<PendingRow>((r) => ({
        id: r.id,
        expires_at: new Date(r.expires_at).getTime(),
        used_at: r.used_at ? new Date(r.used_at).getTime() : null,
        confirmed_at: r.confirmed_at ? new Date(r.confirmed_at).getTime() : null,
      }));
    },
    createPending: async (row) => {
      await db.from("ai_pending_confirmations").insert({
        base_code: baseCode,
        subject: row.subject,
        action: row.action,
        detail: row.detail,
        tool_key: row.toolKey ?? null,
        args: (row.args ?? {}) as never,
        expires_at: new Date(row.expires_at).toISOString(),
      });
    },
    markUsed: async (id) => {
      await db.from("ai_pending_confirmations").update({ used_at: new Date().toISOString() }).eq("id", id);
    },
    now: () => Date.now(),
  };
}

/** O que a pessoa confirmou: qual ferramenta e com quais valores. */
export type PendenciaConfirmada = { tool: string; args: Record<string, unknown> };

/**
 * Marca como CONFIRMADA a pendência MAIS RECENTE do usuário — chamada pela rota do chat
 * quando ele responde afirmativamente. O "sim" vem do USUÁRIO (a IA não tem como setar
 * isto).
 *
 * Devolve a ferramenta E OS ARGUMENTOS. Os argumentos são o ponto: com eles o servidor
 * executa o que a pessoa viu, em vez de devolver a bola ao modelo para reemitir 25
 * parâmetros — que era onde eles mudavam de uma tentativa para outra, e o que fazia o
 * turno do "sim" custar 80 mil tokens.
 */
export async function confirmarPendencia(baseCode: string, subject: string): Promise<PendenciaConfirmada | null> {
  const db = createAdminClient();
  const nowIso = new Date().toISOString();
  const { data } = await db
    .from("ai_pending_confirmations")
    .select("id, tool_key, args")
    .eq("base_code", baseCode)
    .eq("subject", subject)
    .is("used_at", null)
    .is("confirmed_at", null)
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: false })
    .limit(1);
  const row = data?.[0];
  if (!row?.id || !row.tool_key) return null;
  await db.from("ai_pending_confirmations").update({ confirmed_at: nowIso }).eq("id", row.id);
  const args = row.args && typeof row.args === "object" && !Array.isArray(row.args)
    ? (row.args as Record<string, unknown>)
    : {};
  return { tool: row.tool_key, args };
}
