import type { NextRequest } from "next/server";
import { resolveWidgetKey, originAllowed, corsHeaders, clientIp, extractKey, rateLimitOk } from "@/lib/widget/auth";
import { transcreverFormFile } from "@/lib/ai/transcribe-request";

export const runtime = "nodejs";

/** Preflight CORS. */
export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

/**
 * POST /api/v1/transcribe — transcreve o áudio de voz do WIDGET.
 * Auth: chave pública (pk_...) na querystring/header/campo `key`; allowlist de
 * origem e rate-limit iguais aos do /api/v1/chat. Multipart: `file`, `key`.
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);
  const json = (b: unknown, s: number) => Response.json(b, { status: s, headers: cors });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "Envio inválido." }, 400);
  }

  const key = await resolveWidgetKey(extractKey(req, String(form.get("key") ?? "")));
  if (!key) return json({ error: "Chave inválida ou inativa." }, 401);
  if (!originAllowed(key.allowed_origins, origin)) return json({ error: "Origem não autorizada." }, 403);
  if (!(await rateLimitOk(key.id, clientIp(req), key.rate_limit))) {
    return json({ error: "Muitas requisições. Tente em instantes." }, 429);
  }

  const { status, body } = await transcreverFormFile(form.get("file"));
  return json(body, status);
}
