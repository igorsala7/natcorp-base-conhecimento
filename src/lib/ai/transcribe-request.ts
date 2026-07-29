import "server-only";
import { transcreverAudio } from "@/lib/ext/transcribe";

/** Limite do Whisper/OpenAI para o arquivo de áudio. */
const MAX_BYTES = 25 * 1024 * 1024;

/**
 * Transcreve o `file` de um FormData (áudio de voz do chat) usando o provedor
 * parametrizado (Sistema → IA → Transcrição de voz; Whisper por padrão). Retorna
 * `{status, body}` pronto para `Response.json`. Compartilhado pelos endpoints
 * de cada superfície (admin/portal/widget) — a AUTENTICAÇÃO fica em cada rota.
 */
export async function transcreverFormFile(
  file: FormDataEntryValue | null,
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!(file instanceof File)) return { status: 400, body: { error: "Áudio ausente." } };
  if (file.size > MAX_BYTES) return { status: 413, body: { error: "Áudio muito longo (máx. 25 MB)." } };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const tr = await transcreverAudio(bytes);
  if (!tr) {
    return {
      status: 200,
      body: { text: "", transcribed: false, error: "Transcrição de voz não está configurada (Sistema → IA)." },
    };
  }
  return { status: 200, body: { text: tr.text, transcribed: true } };
}
