import { z } from "zod";

/**
 * Validação das variáveis de ambiente públicas (cliente + servidor).
 * Falha cedo e com mensagem clara se algo estiver faltando ou malformado.
 * Segredos de servidor (service_role, db url) NÃO ficam aqui — são lidos
 * apenas em código de servidor, em `env.server.ts`.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
});

export const env = publicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});
