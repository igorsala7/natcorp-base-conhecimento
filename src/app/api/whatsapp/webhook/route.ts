import type { NextRequest } from "next/server";
import { loadWhatsappForPhone, whatsappVerifyToken } from "@/lib/whatsapp/config";
import { processWebhook } from "@/lib/whatsapp/chat";
import { verifySignature } from "@/lib/whatsapp/verify";

export const runtime = "nodejs";

/** Verificação do webhook (handshake da Meta). Aceita se o verify token casar
 *  com QUALQUER canal — cada cliente pode ter a própria conta Meta. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token") ?? "";
  const challenge = url.searchParams.get("hub.challenge") ?? "";

  if (mode === "subscribe" && (await whatsappVerifyToken(token))) {
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("Forbidden", { status: 403 });
}

/** Recebe eventos. Roteia pelo phone_number_id (canal do cliente ou padrão),
 *  valida a assinatura com o app secret DAQUELE canal e processa em 2º plano. */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("bad json", { status: 400 });
  }

  // Roteia pelo número que RECEBEU a mensagem → canal do cliente (ou padrão).
  const rt = await loadWhatsappForPhone(phoneNumberIdDoPayload(payload));
  // Não configurado/inativo: confirma o recebimento e ignora (evita retries).
  if (!rt || !rt.active) return new Response("ok", { status: 200 });

  // Assinatura X-Hub-Signature-256 (HMAC-SHA256 do corpo cru com o app secret DO CANAL).
  if (rt.appSecret) {
    if (!verifySignature(raw, rt.appSecret, req.headers.get("x-hub-signature-256"))) {
      return new Response("invalid signature", { status: 401 });
    }
  }

  // Responde 200 já e processa depois — o LLM/tools podem passar do timeout do webhook.
  void processWebhook(rt, payload).catch((e) => console.error("[whatsapp] webhook:", e));
  return new Response("ok", { status: 200 });
}

/** phone_number_id que recebeu a mensagem (metadata do payload da Meta). */
function phoneNumberIdDoPayload(payload: unknown): string | null {
  try {
    const p = payload as {
      entry?: Array<{ changes?: Array<{ value?: { metadata?: { phone_number_id?: string } } }> }>;
    };
    for (const e of p.entry ?? []) {
      for (const c of e.changes ?? []) {
        const id = c.value?.metadata?.phone_number_id;
        if (id) return id;
      }
    }
  } catch {
    /* ignora */
  }
  return null;
}
