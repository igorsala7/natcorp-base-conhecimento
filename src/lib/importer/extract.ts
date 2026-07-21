import mammoth from "mammoth";
import { getDocumentProxy, getResolvedPDFJS } from "unpdf";
import { encodePng } from "./png";
import { garantirTransferDeArrayBuffer } from "./pdf-compat";

/** Bloco extraído: texto + nível inferido (0 = corpo, 1..3 = título). */
export type ExtractedBlock = {
  text: string;
  level: number;
  fontSize?: number;
  page?: number;
  /** Veio de `<li>`: é passo de lista, nunca título (ver `numberingLevel`). */
  listItem?: boolean;
};

export type ExtractedImage = {
  name: string;
  /** Conteúdo embutido (data URI, DOCX). Vazio quando a imagem é remota. */
  contentBase64: string;
  /** URL já pública (src http/https do HTML) — não precisa subir para o Storage. */
  url?: string;
  mime: string;
  afterBlock: number; // índice do bloco após o qual a imagem aparece
};

export type Extraction = {
  source: "pdf" | "docx" | "html" | "markdown" | "sheet";
  blocks: ExtractedBlock[];
  images: ExtractedImage[];
  /** Imagens descartadas por serem cabeçalho/rodapé de página (ver `podarRepetidas`). */
  droppedChrome?: number;
  /** Bateu no teto de imagens do PDF: o documento tem mais do que foi trazido. */
  imagesCapped?: boolean;
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
  return { source: "docx", blocks, ...podarRepetidas(images) };
}

/** HTML solto → mesmos blocos do DOCX, mais as imagens embutidas no próprio arquivo. */
function extractHtml(html: string): Extraction {
  const images: ExtractedImage[] = [];
  const blocks = htmlToBlocks(html, images);
  return { source: "html", blocks, ...podarRepetidas(images) };
}

const ENTIDADES: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  hellip: "…", mdash: "—", ndash: "–", bull: "•", middot: "·",
  lsquo: "'", rsquo: "'", ldquo: "“", rdquo: "”", laquo: "«", raquo: "»",
  deg: "°", copy: "©", reg: "®", trade: "™", times: "×", divide: "÷",
  euro: "€", pound: "£", yen: "¥", cent: "¢", sect: "§", para: "¶",
  larr: "←", rarr: "→", uarr: "↑", darr: "↓", harr: "↔",
  ordm: "º", ordf: "ª", sup2: "²", sup3: "³", frac12: "½", frac14: "¼",
  szlig: "ß", aelig: "æ", oslash: "ø", ntilde: "ñ", shy: "",
};

/** `&eacute;` → e + acento agudo. Cobre todo o acento latino sem tabela gigante. */
const DIACRITICOS: Record<string, string> = {
  acute: "́", grave: "̀", circ: "̂",
  tilde: "̃", uml: "̈", cedil: "̧", ring: "̊",
};

function decodificar(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-z][a-z0-9]*);/gi, (todo, nome: string) => {
      const direto = ENTIDADES[nome.toLowerCase()];
      if (direto !== undefined) return direto;
      // Padrão letra+diacrítico: &eacute; &ccedil; &atilde; &uuml; …
      const m = nome.match(/^([a-zA-Z])(acute|grave|circ|tilde|uml|cedil|ring)$/);
      const acento = m ? DIACRITICOS[m[2]!.toLowerCase()] : undefined;
      // Entidade desconhecida fica como está: melhor um "&foo;" visível do que
      // texto silenciosamente sumido.
      return acento ? (m![1]! + acento).normalize("NFC") : todo;
    });
}

/** Tags que quebram o fluxo de texto — cada uma fecha o bloco corrente. */
const TAGS_BLOCO = new Set([
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "li", "div", "section", "article", "header", "footer", "main", "aside",
  "td", "th", "tr", "table", "thead", "tbody", "figcaption", "blockquote",
  "pre", "dt", "dd", "ul", "ol", "dl", "br", "hr", "caption",
]);

/** Conteúdo que não é texto do documento. */
const TAGS_IGNORADAS = new Set(["script", "style", "head", "noscript", "svg", "template"]);

function atributo(attrs: string, nome: string): string | null {
  const m = attrs.match(new RegExp(`\\b${nome}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? (m[2] ?? m[3] ?? m[4] ?? null) : null;
}

/**
 * HTML → blocos, por varredura LINEAR (não por regex de tag pareada).
 *
 * A versão anterior casava `<(h1-3|p|li)>…</\1>`, o que custava caro num HTML
 * real: perdia `h4`/`h5`, perdia `<td>` (tabelas), perdia texto solto em `div`
 * e — o pior — só enxergava `<img>` que estivesse dentro de um `<p>`. No manual
 * que você importou as 33 imagens eram filhas diretas de `<div>`: nenhuma era
 * vista. Aninhamento também confundia o par: `<div><h2>` casava o `div` primeiro
 * e o título virava corpo.
 *
 * Aqui cada tag de bloco apenas FECHA o texto acumulado, então o aninhamento é
 * irrelevante e a ordem do documento é preservada — inclusive a das imagens.
 *
 * `images` entra com as imagens já extraídas (caso DOCX, onde o mammoth trocou o
 * `src` por `__IMG_n__`) e sai também com as encontradas aqui (caso HTML).
 */
function htmlToBlocks(html: string, images: ExtractedImage[]): ExtractedBlock[] {
  const blocks: ExtractedBlock[] = [];
  let buffer = "";
  let nivel = 0; // heading aberto no momento
  let emLista = 0; // profundidade de <li> aberto

  const fechar = () => {
    const text = decodificar(buffer).replace(/\s+/g, " ").trim();
    buffer = "";
    if (text) blocks.push(emLista > 0 ? { text, level: nivel, listItem: true } : { text, level: nivel });
  };

  const re = /<\/?([a-zA-Z][\w-]*)\b([^>]*)>/g;
  let ultimo = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(html))) {
    buffer += html.slice(ultimo, m.index);
    ultimo = re.lastIndex;
    const tag = (m[1] ?? "").toLowerCase();
    const fecha = m[0].startsWith("</");

    if (TAGS_IGNORADAS.has(tag)) {
      if (!fecha && !m[0].endsWith("/>")) {
        // Pula o conteúdo inteiro (o <style> deste manual tem 8 KB de CSS).
        const fim = html.toLowerCase().indexOf(`</${tag}>`, re.lastIndex);
        re.lastIndex = fim >= 0 ? fim + tag.length + 3 : html.length;
        ultimo = re.lastIndex;
      }
      continue;
    }

    if (tag === "img" && !fecha) {
      fechar(); // a imagem vem DEPOIS do texto que a antecede
      const src = atributo(m[2] ?? "", "src") ?? "";
      const alt = atributo(m[2] ?? "", "alt") ?? "";
      // DOCX: o mammoth já guardou a imagem e deixou um marcador no src.
      const marcador = src.match(/^__IMG_(\d+)__$/);
      if (marcador) {
        const existente = images[Number(marcador[1])];
        if (existente) existente.afterBlock = blocks.length - 1;
        continue;
      }
      const dataUri = src.match(/^data:(image\/[\w.+-]+);base64,(.+)$/i);
      if (dataUri) {
        images.push({
          name: alt || `img-${images.length + 1}`,
          contentBase64: (dataUri[2] ?? "").replace(/\s+/g, ""),
          mime: dataUri[1] ?? "image/png",
          afterBlock: blocks.length - 1,
        });
      } else if (/^https?:\/\//i.test(src)) {
        // Remota: aproveita a URL como está, sem baixar nem hospedar de novo.
        images.push({
          name: alt || `img-${images.length + 1}`,
          contentBase64: "",
          url: src,
          mime: "image/*",
          afterBlock: blocks.length - 1,
        });
      }
      // src relativo fica de fora: sem o site de origem não há como resolver.
      continue;
    }

    if (TAGS_BLOCO.has(tag)) {
      fechar();
      if (/^h[1-6]$/.test(tag)) nivel = fecha ? 0 : Number(tag[1]);
      if (tag === "li") emLista = fecha ? Math.max(0, emLista - 1) : emLista + 1;
    }
  }

  buffer += html.slice(ultimo);
  fechar();
  return blocks;
}

/**
 * A mesma imagem repetida muitas vezes é mobília de página (logo do cabeçalho,
 * faixa do rodapé), não conteúdo — e era isso que enchia os artigos importados.
 * Vale para qualquer origem: DOCX, HTML e, quando houver, PDF.
 */
const REPETICOES_ATE_VIRAR_MOBILIA = 3;

function podarRepetidas(images: ExtractedImage[]): {
  images: ExtractedImage[];
  droppedChrome: number;
} {
  const chave = (i: ExtractedImage) => i.url ?? i.contentBase64;
  const contagem = new Map<string, number>();
  for (const img of images) contagem.set(chave(img), (contagem.get(chave(img)) ?? 0) + 1);
  const mantidas = images.filter(
    (i) => (contagem.get(chave(i)) ?? 0) < REPETICOES_ATE_VIRAR_MOBILIA,
  );
  return { images: mantidas, droppedChrome: images.length - mantidas.length };
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
 * Limites do caminho de PDF. Um manual de milhares de páginas pode ter uma
 * imagem por página; cada bitmap decodificado ocupa largura×altura×canais bytes
 * na memória do worker, então há teto — e o que for cortado vai para o log.
 */
const MAX_IMAGENS_PDF = 400;
const MIN_LADO_PX = 24; // menor que isso é espaçador, régua ou marca d'água
const MAX_PIXELS = 30_000_000; // ~30 MP: acima disso o bitmap cru passa de 90 MB

type ImagemPdf = {
  imagem: ExtractedImage;
  page: number;
  /** Topo da imagem no espaço da página (y cresce para CIMA no PDF). */
  topo: number;
};

/**
 * Imagens de UMA página, com a posição em que foram desenhadas.
 *
 * O pdf.js não entrega "as imagens da página": entrega a lista de operadores de
 * desenho. Percorremos essa lista mantendo a matriz corrente (save/restore/
 * transform) para saber ONDE cada imagem entra — sem isso, todas cairiam no fim
 * da página e um manual de telas viraria texto seguido de um monte de prints.
 */
async function imagensDaPagina(
  page: Awaited<ReturnType<Awaited<ReturnType<typeof getDocumentProxy>>["getPage"]>>,
  numeroPagina: number,
): Promise<ImagemPdf[]> {
  const { OPS, Util } = await getResolvedPDFJS();
  let ops;
  try {
    ops = await page.getOperatorList();
  } catch {
    return []; // página corrompida não pode derrubar a importação inteira
  }

  const achadas: ImagemPdf[] = [];
  let matriz: number[] = [1, 0, 0, 1, 0, 0];
  const pilha: number[][] = [];

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i] as unknown[];

    if (fn === OPS.save) {
      pilha.push(matriz.slice());
      continue;
    }
    if (fn === OPS.restore) {
      matriz = pilha.pop() ?? matriz;
      continue;
    }
    if (fn === OPS.transform) {
      matriz = Util.transform(matriz, args as number[]);
      continue;
    }
    // `paintImageXObject` referencia por nome; a imagem EMBUTIDA (BI…ID…EI do
    // PostScript) vem com o bitmap no próprio argumento. Máscaras e padrões de
    // repetição ficam de fora: são pintura de fundo, não conteúdo.
    const embutida = fn === OPS.paintInlineImageXObject;
    if (fn !== OPS.paintImageXObject && !embutida) continue;

    const chave = embutida ? `inline-${i}` : args[0];
    if (typeof chave !== "string") continue;
    const bitmap = embutida ? (args[0] as BitmapPdf) : await lerObjeto(page, chave);
    if (!bitmap?.data || !bitmap.width || !bitmap.height) continue;

    const { width, height, data } = bitmap;
    if (width < MIN_LADO_PX || height < MIN_LADO_PX) continue;
    if (width * height > MAX_PIXELS) continue;

    // O pdf.js não expõe os canais direto; deduz-se do tamanho do buffer.
    const canais = Math.round(data.length / (width * height));
    if (canais !== 1 && canais !== 3 && canais !== 4) continue;

    try {
      const png = encodePng(data, width, height, canais);
      achadas.push({
        imagem: {
          name: `${chave}-p${numeroPagina}`,
          contentBase64: png.toString("base64"),
          mime: "image/png",
          afterBlock: -1, // resolvido depois, cruzando com a posição do texto
        },
        page: numeroPagina,
        // A CTM leva o quadrado unitário ao retângulo da imagem: f é a base e
        // d a altura, então o topo é f + d.
        topo: (matriz[5] ?? 0) + (matriz[3] ?? 0),
      });
    } catch {
      // Bitmap fora do padrão (máscara 1bpp, por exemplo) — segue o baile.
    }
  }
  return achadas;
}

type BitmapPdf = { data?: Uint8Array | Uint8ClampedArray; width?: number; height?: number };

/** Segundos de espera por um bitmap antes de desistir dele e seguir. */
const ESPERA_BITMAP_MS = 15_000;

/**
 * Busca o bitmap decodificado.
 *
 * `objs.get(chave)` na forma SÍNCRONA devolve vazio: quando `getOperatorList()`
 * termina, a imagem ainda não chegou do decodificador — é a forma com CALLBACK
 * que espera. Foi por isso que a primeira versão extraiu zero imagem de um PDF
 * que claramente tinha uma. Chaves `g_` vivem nos objetos comuns do documento.
 */
function lerObjeto(
  page: { objs: unknown; commonObjs: unknown },
  chave: string,
): Promise<BitmapPdf | null> {
  const repo = (chave.startsWith("g_") ? page.commonObjs : page.objs) as {
    get?: (k: string, cb: (obj: unknown) => void) => void;
  };
  if (typeof repo?.get !== "function") return Promise.resolve(null);
  return new Promise((resolve) => {
    // Sem o teto, uma imagem que nunca é resolvida trava o job para sempre.
    const relogio = setTimeout(() => resolve(null), ESPERA_BITMAP_MS);
    const pronto = (obj: unknown) => {
      clearTimeout(relogio);
      resolve((obj as BitmapPdf) ?? null);
    };
    try {
      repo.get!(chave, pronto);
    } catch {
      clearTimeout(relogio);
      resolve(null);
    }
  });
}

/**
 * PDF → texto com tamanho de fonte. A hierarquia de títulos se infere do
 * tamanho da fonte: agrupamos os tamanhos e os maiores viram títulos.
 */
async function extractPdf(buf: Buffer): Promise<Extraction> {
  garantirTransferDeArrayBuffer();
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  type Line = { text: string; size: number; page: number; y: number };
  const lines: Line[] = [];
  const imagens: ImagemPdf[] = [];
  let teto = false;

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
      lines.push({ text, size, page: p, y });
    }

    if (imagens.length < MAX_IMAGENS_PDF) {
      imagens.push(...(await imagensDaPagina(page, p)));
    } else {
      teto = true;
    }
    // Um manual de 2.000 páginas não cabe na memória se cada página ficar viva.
    page.cleanup();
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

  ancorarImagens(imagens, lines);
  return {
    source: "pdf",
    blocks,
    ...podarRepetidas(imagens.map((i) => i.imagem)),
    ...(teto ? { imagesCapped: true } : {}),
  };
}

/**
 * Liga cada imagem ao bloco de texto que vem imediatamente ACIMA dela.
 *
 * As linhas já estão em ordem de leitura (página, depois y decrescente), e os
 * blocos saem 1-para-1 delas — então o índice da linha serve como `afterBlock`.
 * Sem isso as imagens iriam todas para o fim do documento e um manual de telas
 * viraria uma parede de texto seguida de um álbum de prints.
 */
function ancorarImagens(imagens: ImagemPdf[], lines: { page: number; y: number }[]): void {
  for (const item of imagens) {
    let indice = -1;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]!;
      if (l.page > item.page) break;
      // Mesma página e acima da imagem (y maior = mais alto na página).
      if (l.page < item.page || l.y >= item.topo) indice = i;
    }
    item.imagem.afterBlock = indice;
  }
  // A ordem final precisa acompanhar a leitura: imagem 2 nunca antes da 1.
  imagens.sort((a, b) => a.imagem.afterBlock - b.imagem.afterBlock);
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
  if (name.endsWith(".xlsx") || name.endsWith(".xlsm") || mime?.includes("spreadsheet")) {
    // Import dinâmico: o exceljs é pesado e só o caminho de planilha precisa dele.
    const { extractSheet } = await import("./extract-sheet");
    return extractSheet(buf);
  }
  if (name.endsWith(".html") || name.endsWith(".htm") || mime === "text/html")
    return extractHtml(buf.toString("utf8"));
  // Texto puro como fallback.
  return extractMarkdown(buf.toString("utf8"));
}
