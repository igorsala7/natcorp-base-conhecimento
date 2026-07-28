import type { NextRequest } from "next/server";
import {
  resolveWidgetKey,
  originAllowed,
  corsHeaders,
  clientIp,
  extractKey,
  rateLimitOk,
} from "@/lib/widget/auth";
import { receiveAttachment } from "@/lib/chat/attachment-store";

export const runtime = "nodejs";

/** Preflight CORS. */
export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

/**
 * POST /api/v1/attach — anexa um documento ao chat do widget (Fase 3C).
 * Multipart: campo `file`. Mesmo portão do chat (chave pública + allowlist de
 * origem + rate limit). Escopo: o espaço DONO da chave. Valida, guarda e extrai
 * o texto; devolve os metadados do anexo (o id volta no `attachmentIds` do chat).
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);
  const json = (body: unknown, status: number) => Response.json(body, { status, headers: cors });

  const key = await resolveWidgetKey(extractKey(req, undefined));
  if (!key) return json({ error: "Chave inválida ou inativa." }, 401);
  if (!originAllowed(key.allowed_origins, origin)) {
    return json({ error: "Origem não autorizada." }, 403);
  }
  // Upload é mais caro que uma pergunta: teto menor que o do chat.
  if (!(await rateLimitOk(key.id, clientIp(req), Math.max(4, Math.floor(key.rate_limit / 3))))) {
    return json({ error: "Muitos envios. Tente em instantes." }, 429);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "Envio inválido." }, 400);
  }
  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "Arquivo ausente." }, 400);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const r = await receiveAttachment(key.space_id, { name: file.name, mime: file.type, bytes });
  if (!r.ok) return json({ error: r.error }, 400);
  return json({ attachment: r.attachment }, 200);
}
