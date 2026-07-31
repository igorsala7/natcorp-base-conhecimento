import "server-only";
import { transcreverAudio } from "@/lib/ext/transcribe";
import { extractDocument } from "@/lib/importer/extract";
import type { ImagePart } from "@/lib/chat/attachment-store";
import type { WhatsappRuntime } from "./config";

const GRAPH = "https://graph.facebook.com/v21.0";

/** Mídia já resolvida em base64 (usado pelo Evolution, que entrega o binário no
 *  próprio evento em vez de um id da Graph API). */
type PreMedia = { base64?: string };

/** Mensagem recebida do WhatsApp (campos que tratamos). Meta traz `id` de mídia
 *  (baixado pela Graph); Evolution já traz `base64`. */
export type WaMessage = {
  id?: string;
  from?: string;
  type?: string;
  text?: { body?: string };
  audio?: { id?: string; mime_type?: string } & PreMedia;
  image?: { id?: string; caption?: string; mime_type?: string } & PreMedia;
  video?: { id?: string; caption?: string; mime_type?: string } & PreMedia;
  document?: { id?: string; filename?: string; caption?: string; mime_type?: string } & PreMedia;
  location?: { latitude?: number; longitude?: number; name?: string; address?: string };
};

/** Conteúdo normalizado que vai para o modelo. */
export type IncomingContent = {
  question: string;
  imageParts?: ImagePart[];
  /** Contexto extra injetado como DADO (texto de arquivo, localização, nota de vídeo). */
  dataContext?: string;
};

/** Resolve a mídia em bytes. Evolution já traz `base64` no evento; Meta traz um
 *  id que baixamos pela Graph API. */
async function fetchMediaBytes(
  rt: WhatsappRuntime,
  media?: { id?: string; base64?: string; mime_type?: string },
): Promise<{ buffer: Buffer; mime: string } | null> {
  if (media?.base64) {
    return { buffer: Buffer.from(media.base64, "base64"), mime: media.mime_type || "application/octet-stream" };
  }
  const mediaId = media?.id;
  if (!mediaId || !rt.accessToken) return null;
  try {
    const meta = await fetch(`${GRAPH}/${mediaId}`, { headers: { Authorization: `Bearer ${rt.accessToken}` } });
    if (!meta.ok) return null;
    const info = (await meta.json()) as { url?: string; mime_type?: string };
    if (!info.url) return null;
    const bin = await fetch(info.url, { headers: { Authorization: `Bearer ${rt.accessToken}` } });
    if (!bin.ok) return null;
    const buffer = Buffer.from(await bin.arrayBuffer());
    return { buffer, mime: info.mime_type || bin.headers.get("content-type") || "application/octet-stream" };
  } catch (e) {
    console.error("[whatsapp] download de mídia:", e);
    return null;
  }
}

/**
 * Converte a mensagem (texto/áudio/imagem/vídeo/arquivo/localização) no conteúdo
 * que o chatbot vai interpretar. Retorna { note } quando não dá para tratar —
 * a note é enviada ao usuário como resposta direta.
 */
export async function extractContent(
  rt: WhatsappRuntime,
  msg: WaMessage,
): Promise<IncomingContent | { note: string }> {
  switch (msg.type) {
    case "text":
      return { question: msg.text?.body ?? "" };

    case "audio": {
      // Voz do microfone → transcreve (Whisper) e trata como texto.
      const m = await fetchMediaBytes(rt, msg.audio);
      if (!m) return { note: "Não consegui baixar o áudio. Pode tentar de novo?" };
      const tr = await transcreverAudio(new Uint8Array(m.buffer));
      if (!tr?.text) return { note: "Não consegui transcrever o áudio. Se puder, escreva a mensagem. 🙂" };
      return { question: tr.text };
    }

    case "image": {
      const m = await fetchMediaBytes(rt, msg.image);
      if (!m) return { note: "Não consegui baixar a imagem." };
      return {
        question: msg.image?.caption?.trim() || "Analise a imagem que enviei e me ajude.",
        imageParts: [{ type: "image", image: new Uint8Array(m.buffer), mediaType: m.mime }],
      };
    }

    case "document": {
      const m = await fetchMediaBytes(rt, msg.document);
      if (!m) return { note: "Não consegui baixar o arquivo." };
      try {
        const ex = await extractDocument(m.buffer, msg.document?.filename || "arquivo", m.mime);
        const texto = ex.blocks
          .map((b) => b.text)
          .filter(Boolean)
          .join("\n")
          .trim();
        if (!texto) return { note: "Recebi o arquivo, mas não consegui extrair texto dele." };
        return {
          question: msg.document?.caption?.trim() || "Analise o documento que enviei.",
          dataContext: `Documento enviado pelo usuário (${msg.document?.filename || "arquivo"}):\n---\n${texto.slice(0, 12000)}\n---`,
        };
      } catch {
        return { note: "Não consegui ler esse tipo de arquivo." };
      }
    }

    case "video": {
      // A IA não analisa quadros de vídeo; usa a legenda e explica o limite.
      const cap = msg.video?.caption?.trim();
      return {
        question: cap || "Recebi seu vídeo.",
        dataContext:
          "O usuário enviou um VÍDEO. Você não consegue ver o conteúdo do vídeo; se precisar, peça uma descrição em texto, ou o envio por foto/áudio.",
      };
    }

    case "location": {
      const l = msg.location;
      const rotulo = [l?.name, l?.address].filter(Boolean).join(" — ");
      return {
        question: "Compartilhei minha localização.",
        dataContext: `O usuário compartilhou a localização: latitude ${l?.latitude}, longitude ${l?.longitude}${rotulo ? `, ${rotulo}` : ""}.`,
      };
    }

    default:
      return {
        note: "Por aqui eu entendo texto, áudio, imagem, vídeo, arquivos e localização. Me manda de uma dessas formas? 🙂",
      };
  }
}
