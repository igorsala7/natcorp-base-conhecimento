import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Multi-tenant (B): SEMÁFORO de concorrência + COTA de tokens por base.
 * Fair-share entre os clientes e teto de custo, DISTRIBUÍDO (estado no Postgres —
 * funciona com N réplicas web/worker). O tenant é `p_base` (a base do cliente) ou
 * `sp:<space_id>` quando não há base.
 */

const DEFAULT_MAX_CONC = Number(process.env.AI_MAX_CONCURRENCY_PER_BASE ?? 20);
const DEFAULT_DAILY_CAP = process.env.AI_DAILY_TOKEN_CAP_PER_BASE ? Number(process.env.AI_DAILY_TOKEN_CAP_PER_BASE) : null;
const LEASE_TTL = Number(process.env.AI_LEASE_TTL_SECONDS ?? 120);

/** Chave do tenant: a base do cliente (p_base) ou o espaço. */
export function tenantKey(pBase?: string | null, spaceId?: string | null): string {
  const b = String(pBase ?? "").trim();
  return b || "sp:" + (spaceId ?? "global");
}

type Limits = { maxConcurrency: number; dailyTokenCap: number | null };
const cache = new Map<string, { at: number; v: Limits }>();
const TTL_MS = 60_000;

async function limitesDe(tenant: string): Promise<Limits> {
  const hit = cache.get(tenant);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.v;
  let v: Limits = { maxConcurrency: DEFAULT_MAX_CONC, dailyTokenCap: DEFAULT_DAILY_CAP };
  try {
    const { data } = await createAdminClient()
      .from("tenant_limits")
      .select("max_concurrency, daily_token_cap")
      .eq("tenant", tenant)
      .maybeSingle();
    v = {
      maxConcurrency: data?.max_concurrency ?? DEFAULT_MAX_CONC,
      dailyTokenCap: data?.daily_token_cap ?? DEFAULT_DAILY_CAP,
    };
  } catch {
    /* usa os defaults */
  }
  cache.set(tenant, { at: Date.now(), v });
  return v;
}

/** Cota diária (24h): `ok:true` se ainda pode; senão traz o consumo e o teto. */
export async function checkQuota(tenant: string): Promise<{ ok: true } | { ok: false; used: number; cap: number }> {
  const { dailyTokenCap } = await limitesDe(tenant);
  if (dailyTokenCap == null) return { ok: true };
  try {
    const { data } = await createAdminClient().rpc("ai_daily_tokens", { p_tenant: tenant });
    const used = Number(data ?? 0);
    if (used >= dailyTokenCap) return { ok: false, used, cap: dailyTokenCap };
  } catch {
    /* não bloqueia por falha de checagem */
  }
  return { ok: true };
}

/** Adquire um slot de concorrência; `null` se a base atingiu o teto. */
export async function acquireSlot(tenant: string): Promise<string | null> {
  const { maxConcurrency } = await limitesDe(tenant);
  try {
    const { data } = await createAdminClient().rpc("ai_slot_acquire", {
      p_tenant: tenant,
      p_max: maxConcurrency,
      p_ttl_seconds: LEASE_TTL,
    });
    return (data as string | null) ?? null;
  } catch {
    return "unguarded"; // falha na infra do semáforo não pode derrubar o chat
  }
}

export async function releaseSlot(leaseId: string | null): Promise<void> {
  if (!leaseId || leaseId === "unguarded") return;
  try {
    await createAdminClient().rpc("ai_slot_release", { p_id: leaseId });
  } catch {
    /* best-effort — o lease expira sozinho pelo TTL */
  }
}

/** Executa `fn` segurando um slot do tenant; lança TenantBusy se estiver cheio. */
export class TenantBusyError extends Error {
  constructor() {
    super("Muitas solicitações simultâneas nesta base. Tente novamente em instantes.");
    this.name = "TenantBusyError";
  }
}
export async function withTenantSlot<T>(tenant: string, fn: () => Promise<T>): Promise<T> {
  const lease = await acquireSlot(tenant);
  if (lease === null) throw new TenantBusyError();
  try {
    return await fn();
  } finally {
    await releaseSlot(lease);
  }
}
