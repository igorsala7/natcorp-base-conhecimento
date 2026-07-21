import { deflateSync } from "node:zlib";

/**
 * Gerador de PDF mínimo — só para os testes.
 *
 * Vive no código (e não como arquivo binário no repositório) porque o valor do
 * teste está em CONHECER a verdade: onde cada texto e cada imagem foram
 * desenhados, em que página e em que altura. Um PDF baixado da internet testaria
 * o extrator contra um oráculo que ninguém consegue ler.
 *
 * Coordenadas em pontos, origem no canto inferior esquerdo (convenção do PDF).
 */

export type TextoPdf = { texto: string; x: number; y: number; tamanho: number };
export type ImagemFixture = {
  x: number;
  /** Base da imagem: o topo é `y + altura`. */
  y: number;
  largura: number;
  altura: number;
  /** Pixels RGB do bitmap (3 bytes por pixel). */
  pixels: Buffer;
  pxLargura: number;
  pxAltura: number;
};
export type PaginaPdf = { textos: TextoPdf[]; imagens?: ImagemFixture[] };

/** Bitmap RGB chapado, útil quando o conteúdo do pixel não importa. */
export function bitmapSolido(w: number, h: number, [r, g, b]: [number, number, number]): Buffer {
  const buf = Buffer.allocUnsafe(w * h * 3);
  for (let i = 0; i < w * h; i++) buf.set([r, g, b], i * 3);
  return buf;
}

export function montarPdf(paginas: PaginaPdf[]): Buffer {
  const objetos: Buffer[] = [];
  /** Registra um objeto e devolve o número dele (1-based). */
  const add = (corpo: Buffer | string) => {
    objetos.push(typeof corpo === "string" ? Buffer.from(corpo, "latin1") : corpo);
    return objetos.length;
  };

  // 1 = catálogo, 2 = árvore de páginas: reservados para manter os refs simples.
  add("<< /Type /Catalog /Pages 2 0 R >>");
  add(""); // preenchido no fim, quando os ids das páginas existirem
  const fonte = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  const idsPagina: number[] = [];

  for (const pagina of paginas) {
    const linhas: string[] = [];
    for (const t of pagina.textos) {
      const escapado = t.texto.replace(/([\\()])/g, "\\$1");
      linhas.push(`BT /F1 ${t.tamanho} Tf ${t.x} ${t.y} Td (${escapado}) Tj ET`);
    }

    const xobjects: string[] = [];
    (pagina.imagens ?? []).forEach((img, i) => {
      const comprimido = deflateSync(img.pixels);
      const id = add(
        Buffer.concat([
          Buffer.from(
            `<< /Type /XObject /Subtype /Image /Width ${img.pxLargura} /Height ${img.pxAltura} ` +
              `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode ` +
              `/Length ${comprimido.length} >>\nstream\n`,
            "latin1",
          ),
          comprimido,
          Buffer.from("\nendstream", "latin1"),
        ]),
      );
      xobjects.push(`/Im${i} ${id} 0 R`);
      // `cm` leva o quadrado unitário ao retângulo de destino: largura, altura,
      // e a translação (x, y) da BASE da imagem.
      linhas.push(`q ${img.largura} 0 0 ${img.altura} ${img.x} ${img.y} cm /Im${i} Do Q`);
    });

    const conteudo = linhas.join("\n");
    const idConteudo = add(
      `<< /Length ${Buffer.byteLength(conteudo, "latin1")} >>\nstream\n${conteudo}\nendstream`,
    );
    idsPagina.push(
      add(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
          `/Resources << /Font << /F1 ${fonte} 0 R >>` +
          (xobjects.length ? ` /XObject << ${xobjects.join(" ")} >>` : "") +
          ` >> /Contents ${idConteudo} 0 R >>`,
      ),
    );
  }

  objetos[1] = Buffer.from(
    `<< /Type /Pages /Kids [${idsPagina.map((i) => `${i} 0 R`).join(" ")}] /Count ${idsPagina.length} >>`,
    "latin1",
  );

  // Serialização com a tabela xref (offsets em bytes de cada objeto).
  const partes: Buffer[] = [Buffer.from("%PDF-1.4\n", "latin1")];
  let offset = partes[0]!.length;
  const offsets: number[] = [];
  objetos.forEach((corpo, i) => {
    const bloco = Buffer.concat([
      Buffer.from(`${i + 1} 0 obj\n`, "latin1"),
      corpo,
      Buffer.from("\nendobj\n", "latin1"),
    ]);
    offsets.push(offset);
    offset += bloco.length;
    partes.push(bloco);
  });

  const inicioXref = offset;
  const xref = [
    `xref\n0 ${objetos.length + 1}\n`,
    "0000000000 65535 f \n",
    ...offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`),
    `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`,
  ].join("");

  return Buffer.concat([...partes, Buffer.from(xref, "latin1")]);
}
