"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

export type LimitResult = { ok: true } | { ok: false; error: string };

async function guard(): Promise<string | null> {
  try {
    await requirePermission("user.manage", null);
    return null;
  } catch {
    return "Sem permissão para gerenciar limites.";
  }
}

const schema = z.object({
  tenant: z.string().trim().min(1, "Informe a base (p_base ou sp:<space_id>).").max(200),
  max_concurrency: z.number().int().min(1).max(100000).nullable(),
  daily_token_cap: z.number().int().min(0).max(1_000_000_000_000).nullable(),
});

/** Cria/atualiza os limites de uma base (concorrência + cota diária de tokens). */
export async function saveTenantLimit(input: unknown): Promise<LimitResult> {
  const negado = await guard();
  if (negado) return { ok: false, error: negado };
  const p = schema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Dados inválidos." };
  const db = createAdminClient();
  const { error } = await db.from("tenant_limits").upsert(
    {
      tenant: p.data.tenant,
      max_concurrency: p.data.max_concurrency,
      daily_token_cap: p.data.daily_token_cap,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/chaves-api");
  return { ok: true };
}

/** Remove o override de uma base (volta aos defaults por env). */
export async function deleteTenantLimit(tenant: string): Promise<LimitResult> {
  const negado = await guard();
  if (negado) return { ok: false, error: negado };
  const db = createAdminClient();
  const { error } = await db.from("tenant_limits").delete().eq("tenant", tenant);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/chaves-api");
  return { ok: true };
}
