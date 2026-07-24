import { getDocumentProxy, renderPageAsImage, createIsomorphicCanvasFactory } from "unpdf";
import { garantirTransferDeArrayBuffer } from "./pdf-compat";

/**
 * Rasteriza páginas de PDF em PNG — usado SÓ no caminho de leitura por IA da
 * OpenAI, que (ao contrário de Anthropic/Gemini) não aceita PDF nativo.
 *
 * Depende de `@napi-rs/canvas` (binário nativo). É import DINÂMICO de propósito:
 * o pacote só é resolvido quando este caminho roda (worker), e se estiver
 * ausente o chamador cai para o modo texto — a importação não quebra.
 */
const canvasImport = () => import("@napi-rs/canvas");

export type RasterPage = { page: number; png: Uint8Array };

/**
 * PNG de cada uma das primeiras `maxPages` páginas. `width` fixa a resolução
 * (largura em px) — 1536 dá leitura boa de telas com custo moderado de tokens.
 */
export async function rasterizePdf(
  buf: Buffer,
  opts: { maxPages?: number; width?: number } = {},
): Promise<RasterPage[]> {
  garantirTransferDeArrayBuffer();
  const width = opts.width ?? 1536;
  const maxPages = opts.maxPages ?? 40;
  // O canvas só é injetado no pdf.js quando o DOCUMENTO é carregado já com o
  // CanvasFactory certo. Passar um proxy "pelado" para `renderPageAsImage` fazia
  // o pdf.js cair no factory-stub que lança "@napi-rs/canvas is not available"
  // — NÃO era questão de versão do Node (falha igual no 20 e no 24). Aqui
  // carregamos o doc UMA vez com o factory e renderizamos cada página a partir
  // dele; o `canvasImport` ainda vai nas opções de render (o factory o exige).
  const CanvasFactory = await createIsomorphicCanvasFactory(canvasImport as never);
  const pdf = await getDocumentProxy(new Uint8Array(buf), { CanvasFactory } as never);
  const total = Math.min(pdf.numPages, maxPages);
  const out: RasterPage[] = [];
  for (let p = 1; p <= total; p++) {
    // `canvasImport` é tipado internamente pelo unpdf; o cast evita o acoplamento
    // ao alias interno do pacote sem perder a checagem dos demais parâmetros.
    const ab = (await renderPageAsImage(pdf, p, {
      canvasImport: canvasImport as never,
      width,
    })) as ArrayBuffer;
    out.push({ page: p, png: new Uint8Array(ab) });
  }
  return out;
}
