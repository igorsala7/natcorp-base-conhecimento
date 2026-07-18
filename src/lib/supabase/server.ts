import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import type { Database } from "@/lib/database.types";

/**
 * Cliente Supabase para Server Components / Server Actions / Route Handlers.
 * Lê e escreve a sessão nos cookies da request. Usa a chave anon — as políticas
 * de RLS é que decidem o que este usuário autenticado pode ver/fazer.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // `setAll` chamado de um Server Component (sem acesso de escrita a
            // cookies). O middleware cuida do refresh da sessão, então é seguro
            // ignorar aqui.
          }
        },
      },
    },
  );
}
