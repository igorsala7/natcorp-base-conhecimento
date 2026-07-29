import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret, tryDecryptSecret } from "@/lib/crypto/secrets";
import type { AuthType } from "@/lib/integrations/credentials";

/** Configuração do canal WhatsApp já com os segredos DECIFRADOS (server-only). */
export type WhatsappRuntime = {
  active: boolean;
  phoneNumberId: string | null;
  appSecret: string | null;
  accessToken: string | null;
  verifyToken: string | null;
  unidentifiedMessage: string;
  identity: {
    endpoint: string | null;
    method: string;
    authType: AuthType;
    phoneParam: string;
    phoneLocal: string;
    map: Record<string, string>;
    secret: Record<string, string>;
  };
};

export async function loadWhatsappRuntime(): Promise<WhatsappRuntime | null> {
  const db = createAdminClient();
  const { data: s } = await db.from("whatsapp_settings").select("*").eq("id", true).maybeSingle();
  if (!s) return null;
  const { data: sec } = await db.from("whatsapp_secrets").select("*").eq("id", true).maybeSingle();

  let idSecret: Record<string, string> = {};
  if (sec?.identity_secret_enc) {
    try {
      idSecret = JSON.parse(decryptSecret(sec.identity_secret_enc));
    } catch {
      idSecret = {};
    }
  }

  return {
    active: s.active,
    phoneNumberId: s.phone_number_id,
    appSecret: tryDecryptSecret(sec?.app_secret_enc),
    accessToken: tryDecryptSecret(sec?.access_token_enc),
    verifyToken: tryDecryptSecret(sec?.verify_token_enc),
    unidentifiedMessage: s.unidentified_message,
    identity: {
      endpoint: s.identity_endpoint,
      method: s.identity_method,
      authType: s.identity_auth_type as AuthType,
      phoneParam: s.identity_phone_param,
      phoneLocal: s.identity_phone_local,
      map: (s.identity_map as Record<string, string>) ?? {},
      secret: idSecret,
    },
  };
}
