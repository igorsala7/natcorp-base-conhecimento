import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Autenticação da extensão de navegador (Fase 5) por TOKEN pessoal.
 *
 * O token cru (`ext_live_<hex>`) só é visto uma vez, no momento da geração; o
 * banco guarda só o SHA-256. Toda rota de ingestão resolve o token → user_id e
 * confere permissão de autoria. Revogável (`revoked_at`). Sem cookies de sessão.
 */
export type ResolvedExtToken = { id: string; user_id: string };

/** Gera um token novo: `ext_live_<32 hex>`. */
export function generateExtToken(): string {
  return `ext_live_${randomBytes(16).toString("hex")}`;
}

/** SHA-256 (hex) do token — o que fica guardado. */
export function hashExtToken(plain: string): string {
  return createHash("sha256").update(plain, "utf8").digest("hex");
}

/** Prefixo exibível na lista (nunca o token inteiro). */
export function extTokenPrefix(plain: string): string {
  return plain.slice(0, 16) + "…";
}

/** Extrai o token cru do header (`X-Extension-Token` ou `Authorization: Bearer`). */
export function extractExtToken(req: NextRequest): string | null {
  const h = req.headers.get("x-extension-token");
  if (h) return h.trim();
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
  return null;
}

/**
 * Resolve um token cru → {id, user_id} se existir e não estiver revogado.
 * Atualiza `last_used_at` (best-effort). Service-role (a extensão não tem
 * sessão Supabase).
 */
export async function resolveExtToken(plain: string | null): Promise<ResolvedExtToken | null> {
  if (!plain || !plain.startsWith("ext_live_")) return null;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("extension_tokens")
    .select("id, user_id, revoked_at")
    .eq("token_hash", hashExtToken(plain))
    .maybeSingle();
  if (!data || data.revoked_at) return null;
  await supabase
    .from("extension_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);
  return { id: data.id, user_id: data.user_id };
}

/**
 * Cabeçalhos CORS para a extensão. A auth é por token no header (não cookies),
 * então refletir a origem `chrome-extension://…` é seguro — não há credencial
 * ambiente para um site malicioso abusar.
 */
export function extCorsHeaders(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Extension-Token, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

/** IP do requisitante (por trás de proxy) — para rate limit. */
export function extClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "0.0.0.0";
}
