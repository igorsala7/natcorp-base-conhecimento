import "server-only";
import type { OutFile } from "@/lib/integrations/documents";
import type { WhatsappRuntime } from "./config";
import { sendEvolutionText, sendEvolutionDocument } from "./evolution";

const GRAPH = "https://graph.facebook.com/v21.0";

/** Envia uma mensagem de texto (Meta Cloud API ou Evolution, conforme o canal). */
export async function sendWhatsappText(rt: WhatsappRuntime, to: string, text: string): Promise<boolean> {
  if (rt.provider === "evolution") return sendEvolutionText(rt, to, text);
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

/** Entrega um arquivo (base64 → binário) como DOCUMENTO: sobe a mídia e envia. */
export async function sendWhatsappDocument(rt: WhatsappRuntime, to: string, file: OutFile): Promise<boolean> {
  if (rt.provider === "evolution") return sendEvolutionDocument(rt, to, file);
  if (!rt.phoneNumberId || !rt.accessToken) return false;
  try {
    const bytes = Buffer.from(file.base64, "base64");
    // 1) upload da mídia (multipart)
    const fd = new FormData();
    fd.append("messaging_product", "whatsapp");
    fd.append("type", file.mimeType);
    fd.append("file", new Blob([bytes], { type: file.mimeType }), file.filename);
    const up = await fetch(`${GRAPH}/${rt.phoneNumberId}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${rt.accessToken}` },
      body: fd,
    });
    if (!up.ok) {
      console.error("[whatsapp] upload de mídia falhou:", up.status, await up.text().catch(() => ""));
      return false;
    }
    const media = (await up.json()) as { id?: string };
    if (!media.id) return false;

    // 2) envia como documento
    const res = await fetch(`${GRAPH}/${rt.phoneNumberId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${rt.accessToken}` },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "document",
        document: { id: media.id, filename: file.filename },
      }),
    });
    if (!res.ok) console.error("[whatsapp] envio de documento falhou:", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (e) {
    console.error("[whatsapp] erro ao enviar documento:", e);
    return false;
  }
}
