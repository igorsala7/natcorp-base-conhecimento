import type { NextRequest } from "next/server";
import { loadWhatsappRuntime } from "@/lib/whatsapp/config";
import { processWebhook } from "@/lib/whatsapp/chat";
import { verifySignature, safeEqual } from "@/lib/whatsapp/verify";

export const runtime = "nodejs";

/** Verificação do webhook (handshake da Meta). */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge") ?? "";

  const rt = await loadWhatsappRuntime();
  if (mode === "subscribe" && rt?.verifyToken && token && safeEqual(token, rt.verifyToken)) {
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("Forbidden", { status: 403 });
}

/** Recebe eventos. Valida a assinatura, confirma 200 e processa em 2º plano. */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const rt = await loadWhatsappRuntime();
  // Não configurado/inativo: confirma o recebimento e ignora (evita retries).
  if (!rt || !rt.active) return new Response("ok", { status: 200 });

  // Assinatura X-Hub-Signature-256 (HMAC-SHA256 do corpo cru com o app secret).
  if (rt.appSecret) {
    if (!verifySignature(raw, rt.appSecret, req.headers.get("x-hub-signature-256"))) {
      return new Response("invalid signature", { status: 401 });
    }
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("bad json", { status: 400 });
  }

  // Responde 200 já e processa depois — o LLM/tools podem passar do timeout do
  // webhook. Funciona porque o servidor é de longa duração (Docker web+worker).
  void processWebhook(rt, payload).catch((e) => console.error("[whatsapp] webhook:", e));
  return new Response("ok", { status: 200 });
}
