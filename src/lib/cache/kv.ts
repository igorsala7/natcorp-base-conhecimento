import "server-only";
import { createHash } from "node:crypto";

/**
 * Cache KV leve para aliviar o Postgres/provedores no pico (5.000 simultâneos).
 * Backend: Upstash Redis via REST (sem SDK/dependência nova) quando
 * `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` estão setados; senão,
 * cache EM MEMÓRIA por instância (com TTL e teto de tamanho). Nunca lança —
 * cache é secundário; falha/miss cai no caminho normal.
 */

const URL_ENV = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN_ENV = process.env.UPSTASH_REDIS_REST_TOKEN;
const usaRedis = !!(URL_ENV && TOKEN_ENV);

// —— Fallback em memória (bounded LRU-ish) ——
const MAX_MEM = 5000;
const mem = new Map<string, { v: string; exp: number }>();
function memGet(key: string): string | null {
  const hit = mem.get(key);
  if (!hit) return null;
  if (hit.exp < Date.now()) {
    mem.delete(key);
    return null;
  }
  // "toque" LRU: reinsere no fim
  mem.delete(key);
  mem.set(key, hit);
  return hit.v;
}
function memSet(key: string, v: string, ttlSeconds: number): void {
  if (mem.size >= MAX_MEM) {
    const oldest = mem.keys().next().value;
    if (oldest) mem.delete(oldest);
  }
  mem.set(key, { v, exp: Date.now() + ttlSeconds * 1000 });
}

async function upstash(cmd: (string | number)[]): Promise<unknown> {
  const r = await fetch(URL_ENV!, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN_ENV}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error("upstash " + r.status);
  return (await r.json())?.result ?? null;
}

/** Chave estável (curta) a partir de um texto arbitrário. */
export function hashKey(prefix: string, texto: string): string {
  return prefix + createHash("sha1").update(texto).digest("hex");
}

export async function kvGet(key: string): Promise<string | null> {
  if (!usaRedis) return memGet(key);
  try {
    const v = await upstash(["GET", key]);
    return typeof v === "string" ? v : null;
  } catch {
    return null;
  }
}

export async function kvSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  if (!usaRedis) {
    memSet(key, value, ttlSeconds);
    return;
  }
  try {
    await upstash(["SET", key, value, "EX", ttlSeconds]);
  } catch {
    /* best-effort */
  }
}

export async function kvGetJson<T>(key: string): Promise<T | null> {
  const s = await kvGet(key);
  if (s == null) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

export async function kvSetJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    await kvSet(key, JSON.stringify(value), ttlSeconds);
  } catch {
    /* best-effort */
  }
}

/** Info do backend em uso (para o endpoint de métricas). */
export function kvBackend(): "redis" | "memoria" {
  return usaRedis ? "redis" : "memoria";
}
