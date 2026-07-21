import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Rate limit por IP para as Server Actions públicas do portal (busca, feedback,
 * senha). As rotas da API do widget já tinham teto via `rateLimitOk`; as
 * actions do portal não tinham nenhum — dava para inserir em `search_logs` e
 * `article_feedback` sem limite, poluindo as Análises de lacunas e engordando
 * as tabelas para sempre.
 *
 * Reusa a mesma RPC `rate_limit_hit` (janela fixa de 60s, durável em Postgres,
 * portanto correta em serverless multi-instância).
 */

/** IP do visitante, atrás de proxy. Espelha `clientIp` de lib/widget/auth. */
export async function portalClientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "0.0.0.0";
}

/**
 * Consome uma requisição do bucket `<acao>:<ip>`. `true` = pode seguir.
 *
 * Falha da RPC libera (best-effort): indisponibilidade do limitador não pode
 * derrubar a busca do portal inteira.
 */
export async function portalRateLimitOk(acao: string, max: number): Promise<boolean> {
  const ip = await portalClientIp();
  const supabase = createAdminClient();
  const { data } = await supabase.rpc("rate_limit_hit", {
    p_bucket: `portal:${acao}:${ip}`,
    p_max: max,
    p_window_seconds: 60,
  });
  return (data ?? true) === true;
}
