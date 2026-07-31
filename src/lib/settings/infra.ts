import "server-only";
import { tryDecryptSecret } from "@/lib/crypto/secrets";

/**
 * Configuração de INFRA/ESCALA resolvida do BANCO (infra_settings), com o `.env`
 * apenas como fallback de bootstrap. Cache curto em memória por instância; o
 * disjuntor (sync) usa o snapshot quente. Ao salvar no admin, chame `invalidarInfra`.
 */
export type Infra = {
  redisUrl: string | null;
  redisToken: string | null;
  maxConcurrency: number;
  dailyTokenCap: number | null;
  leaseTtl: number;
  cbFailures: number;
  cbWindowMs: number;
  cbCooldownMs: number;
};

const num = (v: string | undefined, d: number) =>
  v != null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : d;

function envDefaults(): Infra {
  return {
    redisUrl: process.env.UPSTASH_REDIS_REST_URL || null,
    redisToken: process.env.UPSTASH_REDIS_REST_TOKEN || null,
    maxConcurrency: num(process.env.AI_MAX_CONCURRENCY_PER_BASE, 20),
    dailyTokenCap: process.env.AI_DAILY_TOKEN_CAP_PER_BASE ? Number(process.env.AI_DAILY_TOKEN_CAP_PER_BASE) : null,
    leaseTtl: num(process.env.AI_LEASE_TTL_SECONDS, 120),
    cbFailures: num(process.env.AI_CB_FAILURES, 5),
    cbWindowMs: num(process.env.AI_CB_WINDOW_MS, 30_000),
    cbCooldownMs: num(process.env.AI_CB_COOLDOWN_MS, 20_000),
  };
}

let cache: Infra | null = null;
let cacheAt = 0;
const TTL_MS = 30_000;

async function load(): Promise<Infra> {
  const def = envDefaults();
  try {
    // Import dinâmico: evita avaliar a validação de env (admin → env.ts) no
    // carregamento do módulo — importante para testes e para nunca derrubar o
    // caminho de IA se o env de bootstrap faltar.
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const { data } = await createAdminClient().from("infra_settings").select("*").eq("id", true).maybeSingle();
    if (!data) return def;
    return {
      redisUrl: data.redis_rest_url?.trim() || def.redisUrl,
      redisToken: tryDecryptSecret(data.redis_rest_token_enc) || def.redisToken,
      maxConcurrency: data.max_concurrency_per_base ?? def.maxConcurrency,
      dailyTokenCap: data.daily_token_cap_per_base ?? def.dailyTokenCap,
      leaseTtl: data.lease_ttl_seconds ?? def.leaseTtl,
      cbFailures: data.cb_failures ?? def.cbFailures,
      cbWindowMs: data.cb_window_ms ?? def.cbWindowMs,
      cbCooldownMs: data.cb_cooldown_ms ?? def.cbCooldownMs,
    };
  } catch {
    return def;
  }
}

export async function getInfra(): Promise<Infra> {
  if (cache && Date.now() - cacheAt < TTL_MS) return cache;
  cache = await load();
  cacheAt = Date.now();
  return cache;
}

/** Snapshot SÍNCRONO (para pontos sync como o disjuntor). Último cache quente; se
 *  frio, os defaults do env. As chamadas async mantêm o cache aquecido. */
export function getInfraSync(): Infra {
  return cache ?? envDefaults();
}

/** Invalida o cache local (após salvar no admin nesta réplica). */
export function invalidarInfra(): void {
  cache = null;
  cacheAt = 0;
}
