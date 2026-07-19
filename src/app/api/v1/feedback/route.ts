import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  resolveWidgetKey,
  originAllowed,
  corsHeaders,
  clientIp,
  extractKey,
  rateLimitOk,
} from "@/lib/widget/auth";

export const runtime = "nodejs";

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

/**
 * POST /api/v1/feedback — 👍/👎 na última resposta de uma conversa do widget.
 * Body: { conversationId, value: 1 | -1, key? }. Escopo: só conversas do
 * espaço da chave (isolamento por base de cliente).
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);
  const json = (b: unknown, s: number) => Response.json(b, { status: s, headers: cors });

  let payload: { conversationId?: string; value?: number; key?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }

  const key = await resolveWidgetKey(extractKey(req, payload.key));
  if (!key) return json({ error: "Chave inválida." }, 401);
  if (!originAllowed(key.allowed_origins, origin)) return json({ error: "Origem não autorizada." }, 403);
  if (!(await rateLimitOk(key.id, clientIp(req), key.rate_limit))) {
    return json({ error: "Muitas requisições." }, 429);
  }

  const value = payload.value === 1 ? 1 : payload.value === -1 ? -1 : null;
  if (!payload.conversationId || value === null) return json({ error: "Parâmetros inválidos." }, 400);

  const supabase = createAdminClient();
  // Confere que a conversa pertence ao espaço da chave.
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, space_id")
    .eq("id", payload.conversationId)
    .maybeSingle();
  if (!conv || conv.space_id !== key.space_id) return json({ error: "Conversa não encontrada." }, 404);

  const { data: last } = await supabase
    .from("messages")
    .select("id")
    .eq("conversation_id", conv.id)
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!last) return json({ error: "Sem resposta para avaliar." }, 404);

  await supabase.from("messages").update({ feedback: value }).eq("id", last.id);
  return json({ ok: true }, 200);
}
