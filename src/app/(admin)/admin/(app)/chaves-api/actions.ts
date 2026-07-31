"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";
import { audit } from "@/lib/auth/audit";
import { generateApiKey } from "@/lib/api/keys";
import { API_SCOPES } from "./scopes";

export type ApiKeyResult = { ok: true; secret?: string; id?: string } | { ok: false; error: string };

async function guard(): Promise<string | null> {
  try {
    await requirePermission("user.manage", null);
    return null;
  } catch {
    return "Sem permissão para gerenciar chaves de API.";
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome à chave.").max(120),
  scopes: z.array(z.enum(API_SCOPES)).min(1, "Escolha ao menos um escopo."),
});

export async function createApiKey(input: unknown): Promise<ApiKeyResult> {
  const negado = await guard();
  if (negado) return { ok: false, error: negado };
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const { secret, hash, prefix } = generateApiKey();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("api_keys")
    .insert({ name: parsed.data.name, key_hash: hash, key_prefix: prefix, scopes: parsed.data.scopes, created_by: user?.id ?? null })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: `Falha ao criar: ${error?.message}` };
  await audit({ action: "apikey.create", entityType: "api_key", entityId: data.id, spaceId: null, after: { name: parsed.data.name, scopes: parsed.data.scopes } });
  revalidatePath("/admin/chaves-api");
  return { ok: true, id: data.id, secret }; // o segredo só aparece AQUI, uma vez
}

export async function revokeApiKey(id: string): Promise<ApiKeyResult> {
  const negado = await guard();
  if (negado) return { ok: false, error: negado };
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Chave inválida." };
  const supabase = await createClient();
  const { error } = await supabase.from("api_keys").update({ active: false }).eq("id", id);
  if (error) return { ok: false, error: `Falha ao revogar: ${error.message}` };
  await audit({ action: "apikey.revoke", entityType: "api_key", entityId: id, spaceId: null });
  revalidatePath("/admin/chaves-api");
  return { ok: true };
}
