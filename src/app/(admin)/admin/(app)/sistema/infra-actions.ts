"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptSecret, hasEncryptionKey } from "@/lib/crypto/secrets";
import { invalidarInfra } from "@/lib/settings/infra";

export type InfraResult = { ok: true } | { ok: false; error: string };

const opt = z.number().int().nonnegative().nullable();
const schema = z.object({
  redis_rest_url: z.string().trim().max(500).nullable(),
  // "" = manter o token atual; "__clear__" = remover; qualquer outro = novo token.
  redis_token: z.string().max(2000).optional(),
  max_concurrency_per_base: z.number().int().min(1).max(100000).nullable(),
  daily_token_cap_per_base: z.number().int().min(0).max(1_000_000_000_000).nullable(),
  lease_ttl_seconds: opt,
  cb_failures: opt,
  cb_window_ms: opt,
  cb_cooldown_ms: opt,
});

/** Salva a config de infra/escala (Redis + limites). Segredo do Redis cifrado. */
export async function saveInfra(input: unknown): Promise<InfraResult> {
  try {
    await requirePermission("ai.configure", null);
  } catch {
    return { ok: false, error: "Sem permissão para configurar o sistema." };
  }
  const p = schema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Dados inválidos." };
  const d = p.data;

  const patch: Record<string, unknown> = {
    redis_rest_url: d.redis_rest_url?.trim() || null,
    max_concurrency_per_base: d.max_concurrency_per_base,
    daily_token_cap_per_base: d.daily_token_cap_per_base,
    lease_ttl_seconds: d.lease_ttl_seconds,
    cb_failures: d.cb_failures,
    cb_window_ms: d.cb_window_ms,
    cb_cooldown_ms: d.cb_cooldown_ms,
    updated_at: new Date().toISOString(),
  };
  const novoToken = (d.redis_token ?? "").trim();
  if (novoToken === "__clear__") {
    patch.redis_rest_token_enc = null;
  } else if (novoToken) {
    if (!hasEncryptionKey()) return { ok: false, error: "Defina APP_ENCRYPTION_KEY para guardar o token com segurança." };
    patch.redis_rest_token_enc = encryptSecret(novoToken);
  }

  const db = createAdminClient();
  const { error } = await db.from("infra_settings").update(patch as never).eq("id", true);
  if (error) return { ok: false, error: error.message };
  invalidarInfra();
  revalidatePath("/admin/sistema");
  return { ok: true };
}
