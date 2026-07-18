import "server-only";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

type AuditEntry = {
  action: string;
  entityType?: string;
  entityId?: string;
  spaceId?: string | null;
  before?: unknown;
  after?: unknown;
};

/**
 * Registra uma ação sensível no audit_log, com estado antes/depois, IP e UA.
 * Escreve como o próprio usuário (a policy exige actor_id = auth.uid()).
 * Nunca lança: auditoria não deve derrubar a operação principal.
 */
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const h = await headers();
    await supabase.from("audit_log").insert({
      actor_id: user.id,
      action: entry.action,
      entity_type: entry.entityType ?? null,
      entity_id: entry.entityId ?? null,
      space_id: entry.spaceId ?? null,
      before: (entry.before ?? null) as never,
      after: (entry.after ?? null) as never,
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      user_agent: h.get("user-agent") ?? null,
    });
  } catch {
    // Silencioso por design.
  }
}
