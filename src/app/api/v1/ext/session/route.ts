import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveExtToken, extractExtToken, extCorsHeaders } from "@/lib/ext/auth";

export const runtime = "nodejs";

/** Preflight CORS (a extensão faz POST cross-origin de `chrome-extension://…`). */
export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: extCorsHeaders(req.headers.get("origin")) });
}

/**
 * POST /api/v1/ext/session — inicia uma sessão de captura da extensão (5.0).
 * Auth: token pessoal (`ext_live_…`) no header `X-Extension-Token`. Cria a
 * sessão via service-role (a extensão não tem sessão Supabase) e devolve o id.
 */
export async function POST(req: NextRequest) {
  const cors = extCorsHeaders(req.headers.get("origin"));
  const json = (body: unknown, status: number) => Response.json(body, { status, headers: cors });

  const token = await resolveExtToken(extractExtToken(req));
  if (!token) return json({ error: "Token inválido ou revogado." }, 401);

  const supabase = createAdminClient();

  // Rate limit por usuário (janela de 60s) — evita abuso de um token vazado.
  const { data: allowed } = await supabase.rpc("rate_limit_hit", {
    p_bucket: `ext:session:${token.user_id}`,
    p_max: 60,
    p_window_seconds: 60,
  });
  if (allowed === false) return json({ error: "Muitas sessões. Tente em instantes." }, 429);

  let title: string | null = null;
  try {
    const body = (await req.json()) as { title?: unknown };
    if (typeof body.title === "string") title = body.title.trim().slice(0, 200) || null;
  } catch {
    /* corpo opcional */
  }

  const { data, error } = await supabase
    .from("extension_sessions")
    .insert({ user_id: token.user_id, token_id: token.id, title, status: "active" })
    .select("id, started_at")
    .single();
  if (error || !data) return json({ error: "Falha ao criar a sessão." }, 500);

  return json({ sessionId: data.id, startedAt: data.started_at }, 200);
}
