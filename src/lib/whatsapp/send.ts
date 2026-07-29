import "server-only";
import type { WhatsappRuntime } from "./config";

const GRAPH = "https://graph.facebook.com/v21.0";

/** Envia uma mensagem de texto pela WhatsApp Cloud API. */
export async function sendWhatsappText(rt: WhatsappRuntime, to: string, text: string): Promise<boolean> {
  if (!rt.phoneNumberId || !rt.accessToken) return false;
  try {
    const res = await fetch(`${GRAPH}/${rt.phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${rt.accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        // WhatsApp limita o corpo a 4096 caracteres.
        text: { body: text.slice(0, 4096), preview_url: true },
      }),
    });
    if (!res.ok) console.error("[whatsapp] envio falhou:", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (e) {
    console.error("[whatsapp] erro ao enviar:", e);
    return false;
  }
}
