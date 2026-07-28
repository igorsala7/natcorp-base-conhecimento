import type { NextRequest } from "next/server";
import { resolveExtToken, extractExtToken, extCorsHeaders } from "@/lib/ext/auth";
import { storeShot, assertActiveSession } from "@/lib/ext/store";
import { sanitizarUrl } from "@/lib/ext/sanitize-url";

export const runtime = "nodejs";

/** Preflight CORS. */
export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: extCorsHeaders(req.headers.get("origin")) });
}

/**
 * POST /api/v1/ext/shot — anexa um PRINT a uma sessão de captura (5.1).
 * Multipart: `file` (imagem) + `sessionId` (+ `url`/`title`/`label` opcionais).
 * Auth: token pessoal. A sessão precisa ser do dono do token e estar ATIVA.
 */
export async function POST(req: NextRequest) {
  const cors = extCorsHeaders(req.headers.get("origin"));
  const json = (body: unknown, status: number) => Response.json(body, { status, headers: cors });

  const token = await resolveExtToken(extractExtToken(req));
  if (!token) return json({ error: "Token inválido ou revogado." }, 401);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "Envio inválido." }, 400);
  }
  const sessionId = String(form.get("sessionId") ?? "");
  const session = await assertActiveSession(sessionId, token.user_id);
  if (!session) return json({ error: "Sessão inválida, encerrada ou de outro usuário." }, 403);

  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "Print ausente." }, 400);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const str = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v.slice(0, 500) : null;
  };
  const tRaw = form.get("t_ms");
  const t_ms = typeof tRaw === "string" && Number.isFinite(Number(tRaw)) ? Number(tRaw) : null;
  const r = await storeShot(sessionId, {
    bytes,
    mime: file.type,
    name: file.name || "captura.png",
    url: sanitizarUrl(str("url")), // máscara de segredos na URL
    title: str("title"),
    label: str("label"),
    t_ms,
  });
  if (!r.ok) return json({ error: r.error }, 400);
  return json({ eventId: r.eventId }, 200);
}
