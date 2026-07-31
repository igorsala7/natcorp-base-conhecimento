import "server-only";
import type { OutFile } from "@/lib/integrations/documents";
import type { WhatsappRuntime } from "./config";
import type { WaMessage } from "./media";

/**
 * Adaptador da EVOLUTION API (WhatsApp não-oficial, self-hosted).
 *
 * Diferenças em relação à Meta Cloud API, isoladas aqui:
 *  - Receber: o servidor faz POST de eventos `messages.upsert` no nosso webhook,
 *    com o formato próprio do Evolution (`data.key`, `data.message`). A mídia
 *    vem em base64 no próprio evento (ou é buscada por endpoint).
 *  - Enviar: chamamos o servidor do cliente em `{url}/message/sendText/{instance}`
 *    e `/message/sendMedia/{instance}`, autenticando com o header `apikey`
 *    (guardado como `accessToken` do canal).
 *  - Conexão: a instância é pareada por QR code no próprio servidor Evolution.
 */

/** Base normalizada da URL (sem barra final). */
function serverUrl(rt: WhatsappRuntime): string | null {
  const u = rt.evolutionUrl?.trim();
  if (!u) return null;
  return u.replace(/\/+$/, "");
}

type EvoKey = { remoteJid?: string; fromMe?: boolean; id?: string };
type EvoMessage = {
  conversation?: string;
  extendedTextMessage?: { text?: string };
  imageMessage?: { caption?: string; mimetype?: string };
  audioMessage?: { mimetype?: string };
  videoMessage?: { caption?: string; mimetype?: string };
  documentMessage?: { fileName?: string; caption?: string; mimetype?: string };
  documentWithCaptionMessage?: { message?: { documentMessage?: { fileName?: string; caption?: string; mimetype?: string } } };
  locationMessage?: { degreesLatitude?: number; degreesLongitude?: number; name?: string; address?: string };
  base64?: string;
};
type EvoData = { key?: EvoKey; pushName?: string; message?: EvoMessage; base64?: string; messageType?: string };
type EvoPayload = { event?: string; instance?: string; data?: EvoData | EvoData[] };

/** Instância que recebeu o evento (para rotear ao canal do cliente). */
export function evolutionInstanceDoPayload(payload: unknown): string | null {
  const p = payload as EvoPayload;
  return typeof p?.instance === "string" && p.instance ? p.instance : null;
}

/** Número do remetente a partir do JID (`5511...@s.whatsapp.net` → `5511...`). */
function phoneFromJid(jid?: string): string | null {
  if (!jid) return null;
  if (jid.endsWith("@g.us")) return null; // ignora grupos
  const n = jid.split("@")[0]?.split(":")[0];
  return n && /^\d+$/.test(n) ? n : null;
}

/** Busca o binário de uma mídia pela API do Evolution (quando não vem embutido). */
async function evoFetchBase64(rt: WhatsappRuntime, key: EvoKey): Promise<string | null> {
  const url = serverUrl(rt);
  if (!url || !rt.evolutionInstance || !rt.accessToken) return null;
  try {
    const res = await fetch(`${url}/chat/getBase64FromMediaMessage/${rt.evolutionInstance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: rt.accessToken },
      body: JSON.stringify({ message: { key }, convertToMp4: false }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { base64?: string; media?: string };
    return j.base64 || j.media || null;
  } catch (e) {
    console.error("[evolution] getBase64:", e);
    return null;
  }
}

/** Converte o payload do Evolution em `WaMessage[]` (o mesmo formato interno da
 *  Meta) para reaproveitar todo o pipeline de resposta. */
export async function normalizeEvolution(rt: WhatsappRuntime, payload: unknown): Promise<WaMessage[]> {
  const p = payload as EvoPayload;
  if (p?.event && p.event !== "messages.upsert") return [];
  const itens = Array.isArray(p?.data) ? p.data : p?.data ? [p.data] : [];
  const out: WaMessage[] = [];

  for (const d of itens) {
    const key = d.key ?? {};
    if (key.fromMe) continue; // ignora o que nós mesmos enviamos
    const from = phoneFromJid(key.remoteJid);
    if (!from) continue;
    const m = d.message ?? {};
    const base = { id: key.id, from };
    const embedded = m.base64 || d.base64; // base64 embutido (se o servidor mandar)

    if (m.conversation || m.extendedTextMessage) {
      out.push({ ...base, type: "text", text: { body: m.conversation || m.extendedTextMessage?.text || "" } });
    } else if (m.imageMessage) {
      const b64 = embedded || (await evoFetchBase64(rt, key));
      if (!b64) continue;
      out.push({ ...base, type: "image", image: { caption: m.imageMessage.caption, mime_type: m.imageMessage.mimetype || "image/jpeg", base64: b64 } });
    } else if (m.audioMessage) {
      const b64 = embedded || (await evoFetchBase64(rt, key));
      if (!b64) continue;
      out.push({ ...base, type: "audio", audio: { mime_type: m.audioMessage.mimetype || "audio/ogg", base64: b64 } });
    } else if (m.documentMessage || m.documentWithCaptionMessage) {
      const doc = m.documentMessage ?? m.documentWithCaptionMessage?.message?.documentMessage ?? {};
      const b64 = embedded || (await evoFetchBase64(rt, key));
      if (!b64) continue;
      out.push({ ...base, type: "document", document: { filename: doc.fileName || "arquivo", caption: doc.caption, mime_type: doc.mimetype || "application/octet-stream", base64: b64 } });
    } else if (m.videoMessage) {
      out.push({ ...base, type: "video", video: { caption: m.videoMessage.caption } });
    } else if (m.locationMessage) {
      const l = m.locationMessage;
      out.push({ ...base, type: "location", location: { latitude: l.degreesLatitude, longitude: l.degreesLongitude, name: l.name, address: l.address } });
    }
  }
  return out;
}

/** Envia texto pela Evolution API. */
export async function sendEvolutionText(rt: WhatsappRuntime, to: string, text: string): Promise<boolean> {
  const url = serverUrl(rt);
  if (!url || !rt.evolutionInstance || !rt.accessToken) return false;
  try {
    const res = await fetch(`${url}/message/sendText/${rt.evolutionInstance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: rt.accessToken },
      body: JSON.stringify({ number: to, text: text.slice(0, 4096) }),
    });
    if (!res.ok) console.error("[evolution] envio falhou:", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (e) {
    console.error("[evolution] erro ao enviar:", e);
    return false;
  }
}

/** Entrega um arquivo (base64) como documento pela Evolution API. */
export async function sendEvolutionDocument(rt: WhatsappRuntime, to: string, file: OutFile): Promise<boolean> {
  const url = serverUrl(rt);
  if (!url || !rt.evolutionInstance || !rt.accessToken) return false;
  try {
    const res = await fetch(`${url}/message/sendMedia/${rt.evolutionInstance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: rt.accessToken },
      body: JSON.stringify({
        number: to,
        mediatype: "document",
        mimetype: file.mimeType,
        media: file.base64,
        fileName: file.filename,
      }),
    });
    if (!res.ok) console.error("[evolution] envio de documento falhou:", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (e) {
    console.error("[evolution] erro ao enviar documento:", e);
    return false;
  }
}
