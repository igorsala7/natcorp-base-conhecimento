import type { ProviderKind } from "../ai/catalog";
import type { Extraction } from "./extract";

/**
 * Prepara o documento para a LEITURA pela IA, no formato certo por provedor:
 *  - Anthropic/Google: PDF NATIVO (a IA vê o layout real) + transcrição de apoio.
 *  - OpenAI: páginas RASTERIZADAS em imagem + transcrição de apoio.
 *  - DOCX/HTML/oversize/modelo sem visão: só a transcrição (texto).
 *
 * A transcrição é sempre incluída: ancora o esboço às páginas/posições reais e
 * é a base da rede de fidelidade (comparar as palavras do resultado com as do
 * documento). Puro e testável — a rasterização entra por injeção.
 */

export type DocPart =
  | { type: "text"; text: string }
  | { type: "file"; data: Uint8Array; mediaType: string }
  | { type: "image"; image: Uint8Array; mediaType: string };

export type DocInputMode = "pdf-nativo" | "imagens" | "texto";
export type DocInput = { parts: DocPart[]; modo: DocInputMode };

/** Teto de páginas do PDF nativo (limite prático da Anthropic é ~100). */
export const PDF_PAGE_LIMIT = 100;
/** Teto de páginas rasterizadas (custo de tokens por imagem). */
export const RASTER_PAGE_LIMIT = 40;

/** Maior número de página visto na extração (0 quando a fonte não tem páginas). */
export function pageCount(extraction: Extraction): number {
  let max = 0;
  for (const b of extraction.blocks) if (b.page && b.page > max) max = b.page;
  return max;
}

/**
 * Transcrição textual da extração: marcadores "[Página N]", títulos prefixados
 * por "#" conforme o nível, e "⟦IMG:k⟧" na posição de cada imagem (k = índice
 * no array de imagens, o mesmo usado depois nas URLs).
 */
export function extractionToTranscript(extraction: Extraction): string {
  const imgByBlock = new Map<number, number[]>();
  extraction.images.forEach((img, i) => {
    const arr = imgByBlock.get(img.afterBlock) ?? [];
    arr.push(i);
    imgByBlock.set(img.afterBlock, arr);
  });

  const linhas: string[] = [];
  let pagAtual = -1;
  extraction.blocks.forEach((b, i) => {
    if (b.page && b.page !== pagAtual) {
      pagAtual = b.page;
      linhas.push(`\n[Página ${b.page}]`);
    }
    const prefixo = b.level > 0 ? `${"#".repeat(Math.min(b.level, 4))} ` : "";
    if (b.text) linhas.push(prefixo + b.text);
    for (const k of imgByBlock.get(i) ?? []) linhas.push(`⟦IMG:${k}⟧`);
  });
  return linhas.join("\n").trim();
}

export async function buildDocInput(opts: {
  kind: ProviderKind;
  buf: Buffer;
  extraction: Extraction;
  /** Injetado (worker) — rasteriza o PDF para o caminho OpenAI. */
  rasterize?: (
    buf: Buffer,
    o: { maxPages: number; width?: number },
  ) => Promise<{ page: number; png: Uint8Array }[]>;
}): Promise<DocInput> {
  const { kind, buf, extraction, rasterize } = opts;
  const textPart: DocPart = { type: "text", text: extractionToTranscript(extraction) };

  const isPdf = extraction.source === "pdf";
  const pags = pageCount(extraction);

  // PDF nativo (Anthropic/Gemini) quando cabe no limite de páginas.
  if (isPdf && (kind === "anthropic" || kind === "google") && pags > 0 && pags <= PDF_PAGE_LIMIT) {
    return {
      parts: [textPart, { type: "file", data: new Uint8Array(buf), mediaType: "application/pdf" }],
      modo: "pdf-nativo",
    };
  }

  // OpenAI: rasterizar as páginas em imagem.
  if (isPdf && kind === "openai" && rasterize) {
    try {
      const paginas = await rasterize(buf, { maxPages: RASTER_PAGE_LIMIT });
      if (paginas.length > 0) {
        const imgs: DocPart[] = paginas.map((p) => ({
          type: "image",
          image: p.png,
          mediaType: "image/png",
        }));
        return { parts: [textPart, ...imgs], modo: "imagens" };
      }
    } catch {
      // Sem @napi-rs/canvas ou falha de render → cai para texto.
    }
  }

  // Fallback universal: só a transcrição.
  return { parts: [textPart], modo: "texto" };
}
