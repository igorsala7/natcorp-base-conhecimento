import { deflateSync } from "node:zlib";

/**
 * Codificador PNG mínimo, para as imagens extraídas de PDF.
 *
 * O pdf.js devolve BITMAP CRU (pixels), não um arquivo — e o Storage precisa de
 * um formato que o navegador abra. As alternativas seriam `sharp` (binário
 * nativo, pesado, e mais uma peça para quebrar no deploy) ou `canvas`; para
 * escrever PNG sem filtro nenhum basta zlib, que já vem no Node.
 *
 * Sem filtragem por linha (byte 0 antes de cada scanline): o arquivo fica um
 * pouco maior que o de um codificador completo, mas é correto e previsível.
 */

const ASSINATURA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = TABELA_CRC[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(tipo: string, dados: Buffer): Buffer {
  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32BE(dados.length, 0);
  const corpo = Buffer.concat([Buffer.from(tipo, "ascii"), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo), 0);
  return Buffer.concat([tamanho, corpo, crc]);
}

/** Canais do bitmap → tipo de cor do PNG. */
const TIPO_COR: Record<number, number> = { 1: 0, 3: 2, 4: 6 }; // cinza, RGB, RGBA

export function encodePng(
  pixels: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  channels: 1 | 3 | 4,
): Buffer {
  const colorType = TIPO_COR[channels];
  if (colorType === undefined) throw new Error(`PNG: ${channels} canais não suportado`);
  const esperado = width * height * channels;
  if (pixels.length < esperado) {
    throw new Error(`PNG: bitmap curto (${pixels.length} de ${esperado} bytes)`);
  }

  const linha = width * channels;
  // Cada scanline é precedida do byte de filtro (0 = None).
  const bruto = Buffer.allocUnsafe(height * (linha + 1));
  for (let y = 0; y < height; y++) {
    bruto[y * (linha + 1)] = 0;
    Buffer.from(pixels.buffer, pixels.byteOffset + y * linha, linha).copy(
      bruto,
      y * (linha + 1) + 1,
    );
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bits por canal
  ihdr[9] = colorType;
  // 10..12 = compressão, filtro e entrelaçamento — todos no valor padrão (0).

  return Buffer.concat([
    ASSINATURA,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(bruto, { level: 6 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
