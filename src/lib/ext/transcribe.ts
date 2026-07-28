import "server-only";
import { experimental_transcribe as transcribe } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { resolveAi } from "@/lib/ai/config";

/**
 * Transcrição de voz (Fase 5.4). Usa a finalidade `transcricao` (OpenAI/Whisper
 * — sem atribuição própria, cai no provedor do Chat, mas só transcreve se ele
 * for OpenAI-compatível). Degrada para `null` sem quebrar o fluxo (o áudio fica
 * guardado de qualquer jeito).
 */
/** Trecho da fala com o instante (segundos) em que começa — para ordenar no tempo. */
export type Segmento = { text: string; start: number };
export type Transcricao = { text: string; segments: Segmento[] };

export async function transcreverAudio(bytes: Uint8Array): Promise<Transcricao | null> {
  const cfg = await resolveAi("transcricao");
  if (!cfg || cfg.kind !== "openai") return null; // Whisper é OpenAI-compatível
  // Se o provedor caiu no do Chat, o `model` é de chat — usa Whisper por padrão.
  const modelo = cfg.model && /whisper|transcribe/i.test(cfg.model) ? cfg.model : process.env.TRANSCRIBE_MODEL || "whisper-1";
  try {
    const openai = createOpenAI({ apiKey: cfg.apiKey, ...(cfg.baseUrl ? { baseURL: cfg.baseUrl } : {}) });
    const r = await transcribe({ model: openai.transcription(modelo), audio: bytes });
    const text = (r.text ?? "").trim();
    if (!text) return null;
    const segments: Segmento[] = (r.segments ?? [])
      .map((s) => ({ text: (s.text ?? "").trim(), start: Number(s.startSecond) || 0 }))
      .filter((s) => s.text);
    return { text, segments };
  } catch {
    return null;
  }
}
