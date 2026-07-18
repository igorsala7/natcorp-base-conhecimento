import mammoth from "mammoth";
import { getDocumentProxy } from "unpdf";

/** Bloco extraído: texto + nível inferido (0 = corpo, 1..3 = título). */
export type ExtractedBlock = {
  text: string;
  level: number;
  fontSize?: number;
  page?: number;
};

export type ExtractedImage = {
  name: string;
  contentBase64: string;
  mime: string;
  afterBlock: number; // índice do bloco após o qual a imagem aparece
};

export type Extraction = {
  source: "pdf" | "docx" | "html" | "markdown";
  blocks: ExtractedBlock[];
  images: ExtractedImage[];
};

/** DOCX → usa os estilos de heading nativos (mais confiável que PDF). */
async function extractDocx(buf: Buffer): Promise<Extraction> {
  const images: ExtractedImage[] = [];
  const result = await mammoth.convertToHtml(
    { buffer: buf },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const b64 = await image.read("base64");
        images.push({
          name: `img-${images.length + 1}`,
          contentBase64: b64,
          mime: image.contentType || "image/png",
          afterBlock: -1, // preenchido depois pela ordem no HTML
        });
        return { src: `__IMG_${images.length - 1}__` };
      }),
    },
  );
  const blocks = htmlToBlocks(result.value, images);
  return { source: "docx", blocks, images };
}

/** HTML → blocos por heading/parágrafo. */
function htmlToBlocks(html: string, images: ExtractedImage[]): ExtractedBlock[] {
  const blocks: ExtractedBlock[] = [];
  // Regex simples de blocos (h1-h3, p, li). Suficiente para a inferência.
  const re = /<(h[1-3]|p|li)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const tag = (m[1] ?? "p").toLowerCase();
    const raw = m[2] ?? "";
    // marca imagens pela posição
    const imgMatch = raw.match(/__IMG_(\d+)__/);
    const ii = imgMatch ? Number(imgMatch[1]) : -1;
    const img = ii >= 0 ? images[ii] : undefined;
    if (img) img.afterBlock = blocks.length - 1;
    const text = raw
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;
    const level = tag.startsWith("h") ? Number(tag[1]) : 0;
    blocks.push({ text, level });
  }
  return blocks;
}

/** Markdown → blocos por # e parágrafos. */
function extractMarkdown(text: string): Extraction {
  const blocks: ExtractedBlock[] = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    const h = t.match(/^(#{1,3})\s+(.*)$/);
    if (h) blocks.push({ text: (h[2] ?? "").trim(), level: (h[1] ?? "#").length });
    else blocks.push({ text: t, level: 0 });
  }
  return { source: "markdown", blocks, images: [] };
}

/**
 * PDF → texto com tamanho de fonte. A hierarquia de títulos se infere do
 * tamanho da fonte: agrupamos os tamanhos e os maiores viram títulos.
 */
async function extractPdf(buf: Buffer): Promise<Extraction> {
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  type Line = { text: string; size: number; page: number };
  const lines: Line[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    // Agrupa itens por linha (mesmo y aproximado).
    const byY = new Map<number, { text: string; size: number }[]>();
    for (const item of content.items as {
      str: string;
      transform: number[];
      height?: number;
    }[]) {
      if (!item.str.trim()) continue;
      const y = Math.round(item.transform[5] ?? 0);
      const size = Math.round(Math.abs(item.transform[3] ?? item.height ?? 10));
      const arr = byY.get(y) ?? [];
      arr.push({ text: item.str, size });
      byY.set(y, arr);
    }
    // Ordena linhas de cima para baixo (y decrescente no PDF).
    const ys = [...byY.keys()].sort((a, b) => b - a);
    for (const y of ys) {
      const items = byY.get(y)!;
      const text = items
        .map((i) => i.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (!text) continue;
      const size = Math.max(...items.map((i) => i.size));
      lines.push({ text, size, page: p });
    }
  }

  // Descobre os tamanhos de fonte mais comuns → o modal é "corpo".
  const freq = new Map<number, number>();
  for (const l of lines) freq.set(l.size, (freq.get(l.size) ?? 0) + 1);
  const bodySize =
    [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 10;
  const bigSizes = [...freq.keys()]
    .filter((s) => s > bodySize)
    .sort((a, b) => b - a);
  const sizeToLevel = new Map<number, number>();
  bigSizes.slice(0, 3).forEach((s, i) => sizeToLevel.set(s, i + 1));

  const blocks: ExtractedBlock[] = lines.map((l) => ({
    text: l.text,
    fontSize: l.size,
    page: l.page,
    level: sizeToLevel.get(l.size) ?? (l.size > bodySize ? 3 : 0),
  }));

  // Fallback: se nenhum título por fonte, tenta o outline do PDF.
  if (!blocks.some((b) => b.level > 0)) {
    const outline = await pdf.getOutline().catch(() => null);
    if (outline?.length) {
      for (const o of outline) {
        const idx = blocks.findIndex(
          (b) => b.text.toLowerCase() === o.title.toLowerCase(),
        );
        const target = idx >= 0 ? blocks[idx] : undefined;
        if (target) target.level = 1;
      }
    }
  }

  return { source: "pdf", blocks, images: [] };
}

/** Ponto de entrada: detecta o tipo e extrai. */
export async function extractDocument(
  buf: Buffer,
  filename: string,
  mime?: string,
): Promise<Extraction> {
  const name = filename.toLowerCase();
  if (name.endsWith(".pdf") || mime === "application/pdf") return extractPdf(buf);
  if (name.endsWith(".docx") || mime?.includes("word"))
    return extractDocx(buf);
  if (name.endsWith(".md") || name.endsWith(".markdown"))
    return extractMarkdown(buf.toString("utf8"));
  if (name.endsWith(".html") || name.endsWith(".htm"))
    return { source: "html", blocks: htmlToBlocks(buf.toString("utf8"), []), images: [] };
  // Texto puro como fallback.
  return extractMarkdown(buf.toString("utf8"));
}
