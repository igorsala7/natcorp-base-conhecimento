import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertArquivoSeguro, ehImagem } from "@/lib/importer/file-guard";

/**
 * Persistência de eventos da extensão (Fase 5.1: PRINTS). Reusa o portão de
 * imagem do importador (`assertArquivoSeguro({imagens:true})`) e o Storage
 * privado ('imports', sob 'ext/'). O contador da sessão é atualizado por
 * trigger no banco (não aqui).
 */
const BUCKET = "imports";
const MAX_SHOT_BYTES = 12 * 1024 * 1024;

export type ShotInput = {
  bytes: Uint8Array;
  mime?: string;
  name?: string;
  url?: string | null;
  title?: string | null;
  label?: string | null;
  /** Instante do cliente em que o print foi tirado (epoch ms) — ordena no tempo. */
  t_ms?: number | null;
};
export type ShotResult = { ok: true; eventId: string } | { ok: false; error: string };

/** Valida, guarda e registra um print numa sessão. */
export async function storeShot(sessionId: string, input: ShotInput): Promise<ShotResult> {
  const name = (input.name || "captura.png").slice(0, 120);
  if (!ehImagem(name)) return { ok: false, error: "O print precisa ser uma imagem." };
  if (input.bytes.length === 0) return { ok: false, error: "Imagem vazia." };
  if (input.bytes.length > MAX_SHOT_BYTES) return { ok: false, error: "Print muito grande (máx. 12 MB)." };
  try {
    assertArquivoSeguro(input.bytes, name, { imagens: true });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Imagem inválida." };
  }

  const supabase = createAdminClient();
  const buf = Buffer.from(input.bytes);
  const id = crypto.randomUUID();
  const path = `ext/${sessionId}/${id}.png`;
  const up = await supabase.storage.from(BUCKET).upload(path, buf, {
    contentType: input.mime || "image/png",
    upsert: false,
  });
  if (up.error) return { ok: false, error: "Falha ao guardar o print." };

  const { data, error } = await supabase
    .from("extension_events")
    .insert({
      session_id: sessionId,
      kind: "shot",
      storage_path: path,
      mime: input.mime || "image/png",
      size_bytes: buf.length,
      url: input.url ?? null,
      title: input.title ?? null,
      label: input.label ?? null,
      t_ms: input.t_ms ?? null,
    })
    .select("id")
    .single();
  if (error || !data) {
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    return { ok: false, error: "Falha ao registrar o print." };
  }
  return { ok: true, eventId: data.id };
}

const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // limite prático do Whisper

function audioExt(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4") || mime.includes("m4a")) return "m4a";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("wav")) return "wav";
  return "webm";
}

/** Guarda o áudio da gravação + o texto transcrito como evento `transcript` (5.4).
 *  `t_ms` = início da gravação (epoch ms) e `segments` = trechos temporizados,
 *  para intercalar os prints na ordem da fala (req. 3). */
export async function storeTranscript(
  sessionId: string,
  input: {
    audio: Uint8Array;
    mime: string;
    text: string | null;
    t_ms?: number | null;
    segments?: { text: string; start: number }[];
  },
): Promise<{ ok: true; eventId: string } | { ok: false; error: string }> {
  if (input.audio.length === 0) return { ok: false, error: "Áudio vazio." };
  if (input.audio.length > MAX_AUDIO_BYTES) return { ok: false, error: "Áudio muito grande (máx. 25 MB)." };
  const supabase = createAdminClient();
  const buf = Buffer.from(input.audio);
  const id = crypto.randomUUID();
  const path = `ext/${sessionId}/audio-${id}.${audioExt(input.mime)}`;
  const up = await supabase.storage.from(BUCKET).upload(path, buf, {
    contentType: input.mime || "audio/webm",
    upsert: false,
  });
  if (up.error) return { ok: false, error: "Falha ao guardar o áudio." };

  const { data, error } = await supabase
    .from("extension_events")
    .insert({
      session_id: sessionId,
      kind: "transcript",
      storage_path: path,
      mime: input.mime || "audio/webm",
      size_bytes: buf.length,
      label: (input.text ?? "").slice(0, 20000) || null,
      t_ms: input.t_ms ?? null,
      meta: input.segments && input.segments.length ? ({ segments: input.segments } as never) : null,
    })
    .select("id")
    .single();
  if (error || !data) {
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    return { ok: false, error: "Falha ao registrar a transcrição." };
  }
  return { ok: true, eventId: data.id };
}

/**
 * Confere que a sessão existe, é do usuário do token e está ATIVA. Devolve a
 * sessão (ou null). Usado pelas rotas de ingestão para não aceitar eventos de
 * sessão de outra pessoa ou já finalizada.
 */
export async function assertActiveSession(sessionId: string, userId: string): Promise<{ id: string; space_id: string | null } | null> {
  if (!sessionId) return null;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("extension_sessions")
    .select("id, space_id, status, user_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (!data || data.user_id !== userId || data.status !== "active") return null;
  return { id: data.id, space_id: data.space_id };
}
