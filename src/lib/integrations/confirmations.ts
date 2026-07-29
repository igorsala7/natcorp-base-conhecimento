import "server-only";
import { randomInt } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import type { ConfirmDeps, PendingRow } from "./guards";

/**
 * Deps REAIS do guard de confirmação: guarda a pendência em `ai_pending_confirmations`
 * (só o HASH do código) e entrega o código por e-mail (canal fora-da-banda). O
 * `email` vem do cadastro resolvido no login — o modelo nunca o vê.
 */
export function buildConfirmDeps(baseCode: string, email: string | null): ConfirmDeps {
  const db = createAdminClient();
  return {
    findPending: async (subject, action) => {
      const { data } = await db
        .from("ai_pending_confirmations")
        .select("id, code_hash, expires_at, used_at")
        .eq("base_code", baseCode)
        .eq("subject", subject)
        .eq("action", action)
        .is("used_at", null);
      return (data ?? []).map<PendingRow>((r) => ({
        id: r.id,
        code_hash: r.code_hash,
        expires_at: new Date(r.expires_at).getTime(),
        used_at: r.used_at ? new Date(r.used_at).getTime() : null,
      }));
    },
    createPending: async (row) => {
      await db.from("ai_pending_confirmations").insert({
        base_code: baseCode,
        subject: row.subject,
        action: row.action,
        detail: row.detail,
        code_hash: row.code_hash,
        expires_at: new Date(row.expires_at).toISOString(),
      });
    },
    markUsed: async (id) => {
      await db.from("ai_pending_confirmations").update({ used_at: new Date().toISOString() }).eq("id", id);
    },
    emailFor: async () => email,
    deliver: async (to, code, detail) => {
      const r = await sendEmail({
        to,
        subject: "Código de confirmação — Antecipação salarial",
        html:
          `<p>Use este código para confirmar seu saque${detail ? ` de R$ ${detail}` : ""}:</p>` +
          `<p style="font-size:22px;letter-spacing:3px"><b>${code}</b></p>` +
          `<p>Vale por 10 minutos. Se não foi você, ignore este e-mail.</p>`,
        text: `Código de confirmação do saque${detail ? ` de R$ ${detail}` : ""}: ${code} (vale 10 minutos).`,
      });
      return r.ok;
    },
    genCode: () => String(randomInt(0, 1_000_000)).padStart(6, "0"),
    now: () => Date.now(),
  };
}
