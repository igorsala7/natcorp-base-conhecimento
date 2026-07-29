"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";
import { audit } from "@/lib/auth/audit";
import { encryptSecret } from "@/lib/crypto/secrets";
import { requiredKeys } from "@/lib/integrations/credentials";
import type { IntegResult } from "./actions";

async function garantirPermissao(): Promise<string | null> {
  try {
    await requirePermission("integrations.manage", null);
    return null;
  } catch {
    return "Sem permissão para gerenciar integrações.";
  }
}

const schema = z.object({
  active: z.boolean().default(false),
  phone_number_id: z.string().trim().nullish(),
  waba_id: z.string().trim().nullish(),
  business_account_id: z.string().trim().nullish(),
  unidentified_message: z.string().trim().min(1, "Informe a mensagem para telefone não identificado."),
  identity_endpoint: z.string().trim().nullish(),
  identity_method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  identity_auth_type: z.enum(["none", "basic", "api_key", "bearer", "oauth2"]),
  identity_phone_param: z.string().trim().min(1, "Informe o nome do parâmetro do telefone."),
  identity_phone_local: z.enum(["query", "path", "body", "header"]),
  identity_map: z.record(z.string(), z.string()).default({}),
  // Segredos — vazio = manter o atual.
  appSecret: z.string().nullish(),
  accessToken: z.string().nullish(),
  verifyToken: z.string().nullish(),
  identitySecret: z.record(z.string(), z.string()).nullish(),
});

export async function saveWhatsappConfig(input: unknown): Promise<IntegResult> {
  const negado = await garantirPermissao();
  if (negado) return { ok: false, error: negado };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const d = parsed.data;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Limpa o mapa de identidade: descarta pares com valor em branco.
  const identityMap: Record<string, string> = {};
  for (const [k, v] of Object.entries(d.identity_map)) if (v && v.trim()) identityMap[k] = v.trim();

  const { error } = await supabase
    .from("whatsapp_settings")
    .update({
      active: d.active,
      phone_number_id: d.phone_number_id?.trim() || null,
      waba_id: d.waba_id?.trim() || null,
      business_account_id: d.business_account_id?.trim() || null,
      unidentified_message: d.unidentified_message,
      identity_endpoint: d.identity_endpoint?.trim() || null,
      identity_method: d.identity_method,
      identity_auth_type: d.identity_auth_type,
      identity_phone_param: d.identity_phone_param,
      identity_phone_local: d.identity_phone_local,
      identity_map: identityMap as never,
      updated_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);
  if (error) return { ok: false, error: `Falha ao salvar: ${error.message}` };

  // Segredos simples (só grava quando vem preenchido).
  const simples: [string, string | null | undefined][] = [
    ["app_secret", d.appSecret],
    ["access_token", d.accessToken],
    ["verify_token", d.verifyToken],
  ];
  for (const [campo, valor] of simples) {
    if (valor && valor.trim()) {
      const { error: e } = await supabase.rpc("set_whatsapp_secret", {
        p_campo: campo,
        p_valor_enc: encryptSecret(valor.trim()),
      });
      if (e) return { ok: false, error: `Falha ao gravar ${campo}: ${e.message}` };
    }
  }

  // Credencial da API de identificação (blob por tipo de auth).
  const idSecret: Record<string, string> = {};
  for (const [k, v] of Object.entries(d.identitySecret ?? {})) if (v && v.trim()) idSecret[k] = v.trim();
  if (Object.keys(idSecret).length > 0) {
    if (d.identity_auth_type !== "none") {
      const faltando = requiredKeys(d.identity_auth_type).filter((k) => !idSecret[k]);
      if (faltando.length) return { ok: false, error: `Credencial da API de identificação incompleta: ${faltando.join(", ")}.` };
    }
    const { error: e } = await supabase.rpc("set_whatsapp_secret", {
      p_campo: "identity",
      p_valor_enc: encryptSecret(JSON.stringify(idSecret)),
    });
    if (e) return { ok: false, error: `Falha ao gravar a credencial da identificação: ${e.message}` };
  }

  await audit({ action: "integrations.whatsapp.config", entityType: "whatsapp", entityId: "settings", spaceId: null, after: { active: d.active } });
  revalidatePath("/admin/integracoes");
  return { ok: true };
}
