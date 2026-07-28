import type { NextRequest } from "next/server";
import { resolveExtToken, extractExtToken, extCorsHeaders } from "@/lib/ext/auth";
import { assertActiveSession, storeTranscript } from "@/lib/ext/store";
import { transcreverAudio } from "@/lib/ext/transcribe";

export const runtime = "nodejs";

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: extCorsHeaders(req.headers.get("origin")) });
}

/**
 * POST /api/v1/ext/audio — recebe o áudio da gravação de tela (5.4), transcreve
 * (Whisper, se configurado) e guarda como evento `transcript` na sessão. O texto
 * entra no rascunho ao finalizar. Auth: token; sessão do dono e ATIVA.
 * Multipart: `file` (áudio webm/ogg/…).
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
  const sessionId = String(form.get("sessionId") ?? "");
  const session = await assertActiveSession(sessionId, token.user_id);
  if (!session) return json({ error: "Sessão inválida, encerrada ou de outro usuário." }, 403);

  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "Áudio ausente." }, 400);

  const bytes = new Uint8Array(await file.arrayBuffer());
  // Início da gravação (epoch ms do cliente) — ancora os segmentos no tempo.
  const t_msRaw = form.get("t_ms");
  const t_ms = typeof t_msRaw === "string" && Number.isFinite(Number(t_msRaw)) ? Number(t_msRaw) : null;
  // Transcreve (best-effort — se a IA de transcrição não estiver configurada, o
  // áudio é guardado mesmo sem texto). Retorna texto + segmentos temporizados.
  const tr = await transcreverAudio(bytes);
  const r = await storeTranscript(sessionId, {
    audio: bytes,
    mime: file.type || "audio/webm",
    text: tr?.text ?? null,
    t_ms,
    segments: tr?.segments,
  });
  if (!r.ok) return json({ error: r.error }, 400);
  return json({ eventId: r.eventId, text: tr?.text ?? "", transcribed: tr != null }, 200);
}
