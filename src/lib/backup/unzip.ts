import "server-only";
import { inflateRawSync } from "node:zlib";

/**
 * Leitor de ZIP mínimo, sem dependências — o par do `makeZip` (que escreve
 * "store"). Lê pelo diretório central. Suporta método 0 (store) e 8 (deflate),
 * então também abre zips feitos por ferramentas comuns, não só os nossos.
 */
export type UnzippedEntry = { name: string; data: Uint8Array };

export function readZip(buf: Uint8Array): UnzippedEntry[] {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const dec = new TextDecoder();

  // Acha o End Of Central Directory (assinatura 0x06054b50), varrendo do fim.
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("ZIP inválido: EOCD não encontrado.");

  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true); // offset do diretório central

  const out: UnzippedEntry[] = [];
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break; // fim/registro inesperado
    const method = dv.getUint16(p + 10, true);
    const compSize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const localOff = dv.getUint32(p + 42, true);
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nameLen));

    // Cabeçalho local: os campos de nome/extra podem diferir do central.
    const lNameLen = dv.getUint16(localOff + 26, true);
    const lExtraLen = dv.getUint16(localOff + 28, true);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);
    const data = method === 8 ? new Uint8Array(inflateRawSync(raw)) : raw;

    if (!name.endsWith("/")) out.push({ name, data }); // ignora entradas de pasta
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}
