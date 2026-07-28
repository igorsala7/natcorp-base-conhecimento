import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveExtToken, extractExtToken, extCorsHeaders } from "@/lib/ext/auth";
import { assertActiveSession } from "@/lib/ext/store";
import { sanitizarUrl } from "@/lib/ext/sanitize-url";

export const runtime = "nodejs";

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: extCorsHeaders(req.headers.get("origin")) });
}

/**
 * POST /api/v1/ext/event — registra um evento da trilha (5.2): navegação
 * (`nav`) ou clique (`click`). Auth: token; sessão do dono e ATIVA.
 */
export async function POST(req: NextRequest) {
  const cors = extCorsHeaders(req.headers.get("origin"));
  const json = (b: unknown, s: number) => Response.json(b, { status: s, headers: cors });

  const token = await resolveExtToken(extractExtToken(req));
  if (!token) return json({ error: "Token inválido ou revogado." }, 401);

  let body: { sessionId?: string; kind?: string; url?: string; title?: string; label?: string; t_ms?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }

  const session = await assertActiveSession(String(body.sessionId ?? ""), token.user_id);
  if (!session) return json({ error: "Sessão inválida, encerrada ou de outro usuário." }, 403);

  const kind = ["click", "nav", "scan"].includes(String(body.kind)) ? String(body.kind) : null;
  if (!kind) return json({ error: "Tipo de evento inválido." }, 400);

  // 'scan' guarda a varredura da tela (grande) — teto maior; os demais ≤500.
  const str = (v: unknown, n = 500) => (typeof v === "string" ? v.slice(0, n) : null);
  const supabase = createAdminClient();
  const t_ms = Number.isFinite(Number(body.t_ms)) ? Number(body.t_ms) : null;
  const { error } = await supabase.from("extension_events").insert({
    session_id: session.id,
    kind,
    url: sanitizarUrl(str(body.url)), // máscara: remove segredos da querystring
    title: str(body.title),
    label: str(body.label, kind === "scan" ? 12000 : 500), // varredura pode ser grande
    t_ms,
  });
  if (error) return json({ error: "Falha ao registrar o evento." }, 500);
  return json({ ok: true }, 200);
}
