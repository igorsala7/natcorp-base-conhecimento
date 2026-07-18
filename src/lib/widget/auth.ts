import "server-only";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Configuração visual do widget (guardada em widget_keys.config). */
export type WidgetConfig = {
  primaryColor?: string;
  title?: string;
  welcome?: string;
  avatarUrl?: string;
  suggestions?: string[];
  position?: "right" | "left";
};

export type ResolvedKey = {
  id: string;
  space_id: string;
  allowed_origins: string[];
  rate_limit: number;
  config: WidgetConfig;
};

/**
 * Resolve uma chave pública (pk_...) ativa via service-role. Retorna null se
 * inexistente/inativa. A chave é PÚBLICA: a segurança vem da allowlist de
 * origem + rate limit + escopo fixo no space_id.
 */
export async function resolveWidgetKey(
  publicKey: string | null,
): Promise<ResolvedKey | null> {
  if (!publicKey || !publicKey.startsWith("pk_")) return null;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("widget_keys")
    .select("id, space_id, allowed_origins, rate_limit, config, active")
    .eq("public_key", publicKey)
    .maybeSingle();
  if (!data || !data.active) return null;
  return {
    id: data.id,
    space_id: data.space_id,
    allowed_origins: data.allowed_origins ?? [],
    rate_limit: data.rate_limit ?? 30,
    config: (data.config ?? {}) as WidgetConfig,
  };
}

/**
 * Origem permitida? Allowlist vazia = qualquer origem (conveniente para testar;
 * o admin recomenda restringir). Requisição sem Origin (server-to-server via
 * API REST) é permitida — CORS só se aplica a navegador.
 */
export function originAllowed(allowed: string[], origin: string | null): boolean {
  if (!origin) return true;
  if (allowed.length === 0) return true;
  return allowed.some((a) => a.trim().replace(/\/$/, "") === origin.replace(/\/$/, ""));
}

/** Cabeçalhos CORS. Reflete a origem quando permitida. */
export function corsHeaders(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Widget-Key, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

/** IP do requisitante (por trás de proxy). */
export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "0.0.0.0";
}

/** Extrai a chave pública do header, query ou body. */
export function extractKey(req: NextRequest, bodyKey?: unknown): string | null {
  const header = req.headers.get("x-widget-key");
  if (header) return header;
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  const q = req.nextUrl.searchParams.get("key");
  if (q) return q;
  if (typeof bodyKey === "string") return bodyKey;
  return null;
}

/**
 * Consome uma requisição do bucket. Janela de 60s. Aplica DOIS limites
 * (por chave e por IP) — o menor prevalece. Retorna true se permitido.
 */
export async function rateLimitOk(
  keyId: string,
  ip: string,
  max: number,
): Promise<boolean> {
  const supabase = createAdminClient();
  const [byKey, byIp] = await Promise.all([
    supabase.rpc("rate_limit_hit", { p_bucket: `k:${keyId}`, p_max: max, p_window_seconds: 60 }),
    // Por IP: teto mais folgado (2×) para não punir NAT corporativo, mas ainda barra abuso.
    supabase.rpc("rate_limit_hit", { p_bucket: `ip:${ip}`, p_max: max * 2, p_window_seconds: 60 }),
  ]);
  return (byKey.data ?? true) === true && (byIp.data ?? true) === true;
}

/** Gera uma chave pública nova: pk_live_<32 hex>. */
export function generatePublicKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `pk_live_${hex}`;
}
