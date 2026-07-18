// Gerador de ZIP mínimo (método "store", sem compressão) e sem dependências.
// Suficiente para empacotar Markdown + manifest.json de um espaço.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export type ZipEntry = { name: string; data: string | Uint8Array };

/**
 * Monta um arquivo .zip (store) a partir de entradas de texto/bytes.
 * Datas são fixadas (sem relógio) para builds determinísticos.
 */
export function makeZip(entries: ZipEntry[]): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  const u16 = (n: number) => new Uint8Array([n & 0xff, (n >>> 8) & 0xff]);
  const u32 = (n: number) =>
    new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]);

  for (const e of entries) {
    const nameBytes = enc.encode(e.name);
    const data = typeof e.data === "string" ? enc.encode(e.data) : e.data;
    const crc = crc32(data);
    const dosTime = 0;
    const dosDate = 0x21; // 1980-01-01

    // Local file header
    const local: Uint8Array[] = [
      u32(0x04034b50),
      u16(20), // versão
      u16(0), // flags
      u16(0), // método: store
      u16(dosTime),
      u16(dosDate),
      u32(crc),
      u32(data.length), // comprimido
      u32(data.length), // não comprimido
      u16(nameBytes.length),
      u16(0), // extra len
      nameBytes,
      data,
    ];
    const localSize = local.reduce((s, a) => s + a.length, 0);
    chunks.push(...local);

    // Central directory record
    central.push(
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(dosTime),
      u16(dosDate),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0), // extra
      u16(0), // comment
      u16(0), // disk
      u16(0), // internal attrs
      u32(0), // external attrs
      u32(offset),
      nameBytes,
    );
    offset += localSize;
  }

  const centralStart = offset;
  const centralSize = central.reduce((s, a) => s + a.length, 0);
  const end: Uint8Array[] = [
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralSize),
    u32(centralStart),
    u16(0),
  ];

  const all = [...chunks, ...central, ...end];
  const total = all.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const a of all) {
    out.set(a, p);
    p += a.length;
  }
  return out;
}
