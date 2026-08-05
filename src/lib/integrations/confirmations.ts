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
        expires_at: new Date(row.expires_at).toISOString(),
      });
    },
    markUsed: async (id) => {
      await db.from("ai_pending_confirmations").update({ used_at: new Date().toISOString() }).eq("id", id);
    },
    now: () => Date.now(),
  };
}

/**
 * Marca como CONFIRMADA a pendência de confirmação MAIS RECENTE do usuário — chamada
 * pela rota do chat quando o usuário responde afirmativamente. O "sim" vem do USUÁRIO
 * (a IA não tem como setar isto). Retorna se marcou alguma pendência.
 */
export async function confirmarPendencia(baseCode: string, subject: string): Promise<string | null> {
  const db = createAdminClient();
  const nowIso = new Date().toISOString();
  const { data } = await db
    .from("ai_pending_confirmations")
    .select("id, tool_key")
    .eq("base_code", baseCode)
    .eq("subject", subject)
    .is("used_at", null)
    .is("confirmed_at", null)
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: false })
    .limit(1);
  const row = data?.[0];
  if (!row?.id) return null;
  await db.from("ai_pending_confirmations").update({ confirmed_at: nowIso }).eq("id", row.id);
  return row.tool_key ?? null;
}
