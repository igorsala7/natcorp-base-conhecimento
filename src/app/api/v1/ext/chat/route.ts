import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveExtToken, extractExtToken, extCorsHeaders } from "@/lib/ext/auth";
import { extChatResponder, type ExtChatMsg } from "@/lib/ext/chat";

export const runtime = "nodejs";

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: extCorsHeaders(req.headers.get("origin")) });
}

/**
 * POST /api/v1/ext/chat — chatbot da extensão (req. 5): conversa com o autor
 * para estruturar o artigo a partir do material capturado. Auth: token; a
 * sessão precisa ser do dono do token (ativa ou não). Corpo:
 * `{ sessionId, messages: [{role, content}] }`. Resposta: `{ reply }`.
 */
export async function POST(req: NextRequest) {
  const cors = extCorsHeaders(req.headers.get("origin"));
  const json = (b: unknown, s: number) => Response.json(b, { status: s, headers: cors });

  const token = await resolveExtToken(extractExtToken(req));
  if (!token) return json({ error: "Token inválido ou revogado." }, 401);

  let body: { sessionId?: string; messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }
  const sessionId = String(body.sessionId ?? "");
  if (!sessionId) return json({ error: "Sessão ausente." }, 400);

  // A sessão precisa ser do dono do token (ativa ou finalizada — a conversa é
  // sobre o material capturado).
  const supabase = createAdminClient();
  const { data: sess } = await supabase
    .from("extension_sessions")
    .select("id, user_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (!sess || sess.user_id !== token.user_id) return json({ error: "Sessão inválida ou de outro usuário." }, 403);

  const messages = Array.isArray(body.messages)
    ? body.messages
        .filter((m): m is ExtChatMsg => !!m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))
    : [];
  if (!messages.some((m) => m.role === "user")) return json({ error: "Mensagem vazia." }, 400);

  const r = await extChatResponder(sessionId, messages);
  return json(r.ok ? { reply: r.reply } : { error: r.error }, r.ok ? 200 : 503);
}
