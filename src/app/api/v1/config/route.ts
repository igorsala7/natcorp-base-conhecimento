import type { NextRequest } from "next/server";
import { hasAiKey } from "@/lib/ai/config";
import {
  resolveWidgetKey,
  originAllowed,
  corsHeaders,
  extractKey,
} from "@/lib/widget/auth";

export const runtime = "nodejs";

/** Preflight CORS. */
export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

/**
 * GET /api/v1/config?key=pk_... — bootstrap do widget: devolve a config visual
 * (cor, avatar, boas-vindas, sugestões, posição) do widget_keys.config.
 */
export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);
  const key = await resolveWidgetKey(extractKey(req));
  if (!key) return Response.json({ error: "Chave inválida." }, { status: 401, headers: cors });
  if (!originAllowed(key.allowed_origins, origin)) {
    return Response.json({ error: "Origem não autorizada." }, { status: 403, headers: cors });
  }
  return Response.json(
    { config: key.config, aiEnabled: hasAiKey() },
    { headers: cors },
  );
}
