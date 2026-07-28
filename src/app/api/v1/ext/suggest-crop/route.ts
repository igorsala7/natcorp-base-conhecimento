import type { NextRequest } from "next/server";
import { resolveExtToken, extractExtToken, extCorsHeaders } from "@/lib/ext/auth";
import { sugerirRecorte } from "@/lib/ext/suggest-crop";

export const runtime = "nodejs";

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: extCorsHeaders(req.headers.get("origin")) });
}

/**
 * POST /api/v1/ext/suggest-crop — a IA sugere um recorte para o print (5.3).
 * Multipart: `file` (imagem). Auth: token (não precisa de sessão — é um ajudante
 * sem estado). Responde `{ crop: {x,y,w,h} }` em frações 0..1, ou `{ crop: null }`.
 */
export async function POST(req: NextRequest) {
  const cors = extCorsHeaders(req.headers.get("origin"));
  const json = (b: unknown, s: number) => Response.json(b, { status: s, headers: cors });

  const token = await resolveExtToken(extractExtToken(req));
  if (!token) return json({ error: "Token inválido ou revogado." }, 401);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "Envio inválido." }, 400);
  }
  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "Imagem ausente." }, 400);
  if (!file.type.startsWith("image/")) return json({ error: "Só imagens." }, 400);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const crop = await sugerirRecorte(bytes, file.type);
  return json({ crop }, 200);
}
