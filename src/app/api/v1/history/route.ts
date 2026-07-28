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
import { decodeTrackForSpace } from "@/lib/tracking/resolve";
import { fetchLatestHistory, identityMatch } from "@/lib/chat/history-store";

export const runtime = "nodejs";

/** Preflight CORS. */
export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

type Payload = {
  key?: string;
  sessionId?: string;
  track?: unknown;
  /** Instante do "Limpar" no cliente — mensagens anteriores não voltam. */
  afterIso?: string;
};

/**
 * POST /api/v1/history — releitura do histórico do widget por identidade (3B).
 * Mesmo portão do chat (chave pública + allowlist de origem + rate limit).
 * Escopo: o espaço DONO da chave. Casa por (p_base, p_usuario) e, sem eles,
 * pela sessão do navegador. Responde `{conversationId, messages}` ou
 * `{messages: []}` — o widget nunca pede login.
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);
  const json = (body: unknown, status: number) => Response.json(body, { status, headers: cors });

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }

  const key = await resolveWidgetKey(extractKey(req, payload.key));
  if (!key) return json({ error: "Chave inválida ou inativa." }, 401);
  if (!originAllowed(key.allowed_origins, origin)) {
    return json({ error: "Origem não autorizada." }, 403);
  }
  if (!(await rateLimitOk(key.id, clientIp(req), key.rate_limit))) {
    return json({ error: "Muitas requisições. Tente em instantes." }, 429);
  }

  const t = await decodeTrackForSpace(key.space_id, payload.track);
  const match = identityMatch(
    t.p_base,
    t.p_usuario,
    typeof payload.sessionId === "string" ? payload.sessionId : undefined,
  );
  if (!match) return json({ messages: [] }, 200);

  const history = await fetchLatestHistory(createAdminClient(), key.space_id, match, payload.afterIso);
  return json(history ?? { messages: [] }, 200);
}
