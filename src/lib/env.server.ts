import "server-only";
import { z } from "zod";

/**
 * Segredos que SÓ existem no servidor. O import de "server-only" garante que,
 * se este módulo vazar para um bundle de cliente, o build quebra — exatamente
 * a regra da spec sobre a service_role.
 */
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  /**
   * Assina o cookie de acesso a documentação protegida por senha.
   *
   * Opcional com fallback para a service-role, que era o que assinava antes.
   * Sem o fallback, todo cookie em voo viraria inválido no deploy — e nenhum
   * ambiente tem a variável ainda. Vale separar porque hoje rotacionar a
   * chave-mestra do banco desloga todos os leitores, e vice-versa não há como
   * invalidar sessões do portal sem mexer no banco.
   */
  PORTAL_COOKIE_SECRET: z.string().min(1).optional(),
});

export const serverEnv = serverSchema.parse({
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  PORTAL_COOKIE_SECRET: process.env.PORTAL_COOKIE_SECRET,
});
