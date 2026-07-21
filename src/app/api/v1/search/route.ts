import type { NextRequest } from "next/server";
import { retrievePublicContext } from "@/lib/ai/rag";
import {
  resolveWidgetKey,
  originAllowed,
  corsHeaders,
  clientIp,
  extractKey,
  rateLimitOk,
} from "@/lib/widget/auth";

export const runtime = "nodejs";

/** Preflight CORS. */
export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

/**
 * POST /api/v1/search — busca híbrida pública, escopada ao espaço da chave.
 * Body: { query: string, limit?: number, key?: string }
 * Resposta: { results: [{ title, heading_path, snippet, url, score? }] }
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);
  const json = (body: unknown, status: number) =>
    Response.json(body, { status, headers: cors });

  let payload: { query?: string; limit?: number; key?: string };
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

  const query = (payload.query ?? "").trim();
  if (!query) return json({ error: "Consulta vazia." }, 400);
  const limit = Math.min(Math.max(payload.limit ?? 8, 1), 20);

  // space_ids (união de widget_key_spaces), não space_id: a busca precisa
  // enxergar as mesmas documentações que /api/v1/chat enxerga.
  const sources = await retrievePublicContext(key.space_ids, query, limit);
  const results = sources.map((s) => ({
    title: s.title,
    heading_path: s.heading_path,
    snippet: s.snippet ?? s.content.slice(0, 200),
    url: s.url,
  }));
  return json({ results }, 200);
}
