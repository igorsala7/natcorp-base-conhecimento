import "server-only";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import type { Database } from "@/lib/database.types";

/**
 * Cliente Supabase SEM sessão — sempre atua como `anon`. Usado no portal
 * público para garantir uma visão consistente (só conteúdo publicado em
 * espaço público, via RLS), independentemente de haver um admin logado.
 */
export function createPublicClient() {
  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: { getAll: () => [], setAll: () => {} },
    },
  );
}
