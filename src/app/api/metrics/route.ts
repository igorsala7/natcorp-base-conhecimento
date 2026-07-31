import type { NextRequest } from "next/server";
import { authorize, apiJson } from "@/lib/api/manage";
import { createAdminClient } from "@/lib/supabase/admin";
import { filaMetrics } from "@/lib/jobs/boss";
import { circuitSnapshot } from "@/lib/ai/circuit-breaker";
import { kvBackend } from "@/lib/cache/kv";

export const runtime = "nodejs";

/**
 * GET /api/metrics — observabilidade operacional (chave sk_ + escopo data.analyze).
 * Profundidade das filas, concorrência (leases ativos), taxa de uso de IA (RPM/TPM)
 * na última 1min/5min, disjuntores e backend de cache. Os disjuntores e o cache
 * refletem ESTA réplica web (estado em memória); filas/leases/uso são globais.
 */
export async function GET(req: NextRequest) {
  const auth = await authorize(req, "data.analyze");
  if ("error" in auth) return auth.error;

  const db = createAdminClient();
  const agora = new Date().toISOString();
  const [filas, leases, u1, u5] = await Promise.all([
    filaMetrics().catch(() => ({}) as Record<string, number>),
    db.from("ai_leases").select("tenant").gt("expires_at", agora),
    db.rpc("ai_usage_window", { p_seconds: 60 }),
    db.rpc("ai_usage_window", { p_seconds: 300 }),
  ]);
  const tenants = new Set((leases.data ?? []).map((r) => r.tenant));

  return apiJson({
    ok: true,
    ts: agora,
    filas,
    concorrencia: { leases_ativos: leases.data?.length ?? 0, bases_ativas: tenants.size },
    ia_1min: u1.data ?? null,
    ia_5min: u5.data ?? null,
    disjuntores: circuitSnapshot(),
    cache: kvBackend(),
  });
}
