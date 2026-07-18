import "server-only";
import { z } from "zod";

/**
 * Segredos que SÓ existem no servidor. O import de "server-only" garante que,
 * se este módulo vazar para um bundle de cliente, o build quebra — exatamente
 * a regra da spec sobre a service_role.
 */
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export const serverEnv = serverSchema.parse({
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
});
