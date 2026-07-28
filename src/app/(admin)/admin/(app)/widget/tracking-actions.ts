"use server";

import { getSessionUser, requirePermission } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptSecret, tryDecryptSecret } from "@/lib/crypto/secrets";
import { gerarChaveRastreio, assinarRastreio } from "@/lib/tracking/token";
import { TRACKING_KEYS } from "@/lib/chat/tracking";

/**
 * Chave de RASTREIO por espaço: o segredo com que o backend do cliente cifra os
 * parâmetros p_* num token à prova de adulteração. Guardada cifrada em repouso,
 * numa tabela isolada (só service-role alcança). Gerar/ver exige `widget.manage`.
 */
export type TrackingKeyInfo = { hasKey: boolean; key: string | null };

/** Lê a chave (decifrada) para o admin configurar o backend. Gated por permissão. */
export async function getTrackingKey(spaceId: string): Promise<TrackingKeyInfo> {
  await requirePermission("widget.manage", spaceId);
  const admin = createAdminClient();
  const { data } = await admin
    .from("space_tracking_keys")
    .select("key_enc")
    .eq("space_id", spaceId)
    .maybeSingle();
  const key = data?.key_enc ? tryDecryptSecret(data.key_enc) : null;
  return { hasKey: !!key, key };
}

/** Gera (ou ROTACIONA) a chave do espaço. Rotacionar invalida os tokens antigos. */
export async function generateTrackingKey(
  spaceId: string,
): Promise<{ ok: true; key: string } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sua sessão expirou. Recarregue a página." };
  try {
    await requirePermission("widget.manage", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão para gerenciar o rastreio deste espaço." };
  }
  const key = gerarChaveRastreio();
  const admin = createAdminClient();
  const { error } = await admin.from("space_tracking_keys").upsert(
    { space_id: spaceId, key_enc: encryptSecret(key), updated_by: user.id, updated_at: new Date().toISOString() },
    { onConflict: "space_id" },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true, key };
}

/** Remove a chave: o espaço volta a NÃO registrar identidade (tokens são ignorados). */
export async function deleteTrackingKey(spaceId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sessão expirada." };
  try {
    await requirePermission("widget.manage", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }
  const admin = createAdminClient();
  const { error } = await admin.from("space_tracking_keys").delete().eq("space_id", spaceId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Gera um token de EXEMPLO a partir de valores de teste — para o admin conferir. */
export async function previewTrackingToken(
  spaceId: string,
  params: Record<string, string>,
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const info = await getTrackingKey(spaceId); // já checa a permissão
  if (!info.key) return { ok: false, error: "Gere a chave de rastreio primeiro." };
  const payload: Record<string, string> = {};
  for (const k of TRACKING_KEYS) {
    const v = params[k];
    if (typeof v === "string" && v.trim()) payload[k] = v.trim().slice(0, 200);
  }
  return { ok: true, token: assinarRastreio(info.key, payload) };
}
