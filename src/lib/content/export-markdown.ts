// Conversor content_json → Markdown, sem dependências.
// Aceita BlockDoc v2 ou TipTap legado (normalizeDoc converte na leitura).
import { normalizeDoc } from "@/lib/blocks/convert";
import { blocksToMarkdown } from "@/lib/blocks/serialize";

/** Documento (blocos v2 ou TipTap) → Markdown. */
export function docToMarkdown(doc: unknown): string {
  return blocksToMarkdown(normalizeDoc(doc).blocks);
}
