import "server-only";
import { z } from "zod";
import { generateObject } from "ai";
import { languageModel, hasAiKey, aiTimeout, ehTimeout } from "@/lib/ai/config";

/**
 * Recorte sugerido pela IA (Fase 5.3). Um modelo com VISÃO olha o print e
 * devolve o retângulo (em frações 0..1) que enquadra o conteúdo relevante para
 * documentar — cortando menus laterais, cabeçalho do navegador e áreas vazias.
 * Se a tela inteira já for relevante, devolve `found:false` → sem sugestão.
 *
 * Só DICA: o usuário sempre ajusta e confirma o recorte no painel.
 */
const schema = z.object({
  found: z.boolean().describe("true se há uma região principal a recortar; false se a tela inteira é relevante"),
  x: z.number().min(0).max(1).describe("borda esquerda em fração da largura"),
  y: z.number().min(0).max(1).describe("borda superior em fração da altura"),
  w: z.number().min(0).max(1).describe("largura em fração"),
  h: z.number().min(0).max(1).describe("altura em fração"),
});

export type CropSuggestion = { x: number; y: number; w: number; h: number };

export async function sugerirRecorte(bytes: Uint8Array, mime: string): Promise<CropSuggestion | null> {
  if (!(await hasAiKey("chat"))) return null;
  try {
    const { object } = await generateObject({
      model: await languageModel("chat"),
      schema,
      abortSignal: aiTimeout("chat"),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Esta é uma captura de tela de um sistema web. Sugira o retângulo que enquadra o CONTEÚDO PRINCIPAL relevante para documentar este passo — descarte a barra do navegador, menus laterais/superiores de navegação e áreas vazias ao redor. Responda em FRAÇÕES de 0 a 1 (x,y = canto superior-esquerdo; w,h = largura e altura). Se a tela inteira já for relevante e não valer recortar, use found=false.",
            },
            { type: "image", image: bytes, mediaType: mime || "image/png" },
          ],
        },
      ],
    });
    if (!object.found) return null;
    const x = Math.max(0, Math.min(object.x, 1));
    const y = Math.max(0, Math.min(object.y, 1));
    const w = Math.min(object.w, 1 - x);
    const h = Math.min(object.h, 1 - y);
    // Recorte minúsculo não ajuda — descarta.
    if (w < 0.1 || h < 0.1) return null;
    return { x, y, w, h };
  } catch (e) {
    if (ehTimeout(e)) return null;
    return null;
  }
}
