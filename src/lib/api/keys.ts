import "server-only";
import { createHash, randomBytes } from "node:crypto";

/**
 * Chaves SECRETAS de API (item #5) — auth server-to-server das rotas /api/manage.
 * Formato `sk_live_<random>`; guardamos só o SHA-256. Os escopos são as
 * permissões RBAC (content.view, content.publish, …). Ver [[widget-and-api]].
 */

const PREFIX = "sk_live_";

export type ApiKeyCtx = { id: string; name: string; scopes: string[] };

/** Hash determinístico do segredo (o que fica no banco). */
export function hashKey(secret: string): string {
  return createHash("sha256").update(secret.trim()).digest("hex");
}

/** Gera um novo segredo + o hash e o prefixo exibível. O segredo só existe aqui. */
export function generateApiKey(): { secret: string; hash: string; prefix: string } {
  const secret = PREFIX + randomBytes(24).toString("base64url");
  return { secret, hash: hashKey(secret), prefix: secret.slice(0, 14) + "…" };
}

/** Extrai o Bearer do cabeçalho Authorization. */
export function bearerToken(req: Request): string | null {
  const m = /^Bearer\s+(.+)$/i.exec((req.headers.get("authorization") || "").trim());
  return m ? m[1]!.trim() : null;
}

/** Resolve a chave da requisição → contexto (id/nome/escopos) ou null. */
export async function resolveApiKey(req: Request): Promise<ApiKeyCtx | null> {
  const secret = bearerToken(req);
  if (!secret || !secret.startsWith(PREFIX)) return null;
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const db = createAdminClient();
  const { data } = await db
    .from("api_keys")
    .select("id, name, scopes, active")
    .eq("key_hash", hashKey(secret))
    .maybeSingle();
  if (!data || !data.active) return null;
  await db.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return { id: data.id, name: data.name, scopes: data.scopes ?? [] };
}

export function hasScope(ctx: ApiKeyCtx, scope: string): boolean {
  return ctx.scopes.includes(scope);
}
