import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";

/**
 * Cliente administrativo com service_role — ignora RLS. Uso restrito a
 * operações de servidor confiáveis (ex.: seed/convite do primeiro admin).
 * NUNCA importar em componente de cliente. Não persiste sessão.
 */
export function createAdminClient() {
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
