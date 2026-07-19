import { describe, it, expect } from "vitest";
import { makeZip } from "./zip";

const u32le = (b: Uint8Array, o: number) =>
  (b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16) | (b[o + 3]! << 24)) >>> 0;
const u16le = (b: Uint8Array, o: number) => b[o]! | (b[o + 1]! << 8);

describe("makeZip", () => {
  it("gera um zip com assinatura local e EOCD válidos", () => {
    const zip = makeZip([
      { name: "manifest.json", data: '{"ok":true}' },
      { name: "content/a.md", data: "# Título com acento: emissão\n" },
    ]);
    // Assinatura do primeiro local file header: PK\x03\x04
    expect(u32le(zip, 0)).toBe(0x04034b50);

    // End of Central Directory: assinatura PK\x05\x06 nos últimos 22 bytes.
    const eocd = zip.length - 22;
    expect(u32le(zip, eocd)).toBe(0x06054b50);
    // nº de entradas no diretório central = 2
    expect(u16le(zip, eocd + 10)).toBe(2);
  });

  it("inclui os nomes dos arquivos", () => {
    const zip = makeZip([{ name: "pasta/arquivo.md", data: "x" }]);
    const text = new TextDecoder().decode(zip);
    expect(text).toContain("pasta/arquivo.md");
  });
});
