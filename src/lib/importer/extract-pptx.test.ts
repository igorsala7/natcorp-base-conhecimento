import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { extractDocument } from "./extract";

/** Monta um .pptx mínimo (só o que a extração lê: ppt/slides/slideN.xml). */
async function fakePptx(slides: string[][]): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", '<?xml version="1.0"?><Types/>');
  slides.forEach((paras, i) => {
    const body = paras.map((t) => `<a:p><a:r><a:t>${t}</a:t></a:r></a:p>`).join("");
    zip.file(
      `ppt/slides/slide${i + 1}.xml`,
      `<?xml version="1.0"?><p:sld xmlns:a="x"><p:cSld><p:spTree>${body}</p:spTree></p:cSld></p:sld>`,
    );
  });
  return Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
}

describe("extractDocument — pptx", () => {
  it("extrai texto por slide (1º parágrafo = título, resto = corpo)", async () => {
    const buf = await fakePptx([["Título A", "Corpo A1", "Corpo A2"], ["Título B"]]);
    const ex = await extractDocument(buf, "apresentacao.pptx");
    expect(ex.source).toBe("pptx");
    expect(ex.blocks.map((b) => b.text)).toEqual(["Título A", "Corpo A1", "Corpo A2", "Título B"]);
    expect(ex.blocks[0]!.level).toBe(1);
    expect(ex.blocks[1]!.level).toBe(0);
  });

  it("preserva a ordem dos slides", async () => {
    const buf = await fakePptx([["S1"], ["S2"], ["S3"]]);
    const ex = await extractDocument(buf, "a.pptx");
    expect(ex.blocks.map((b) => b.text)).toEqual(["S1", "S2", "S3"]);
  });

  it("decodifica entidades XML", async () => {
    const buf = await fakePptx([["A &amp; B &lt;x&gt;"]]);
    const ex = await extractDocument(buf, "a.pptx");
    expect(ex.blocks[0]!.text).toBe("A & B <x>");
  });

  it("o guarda rejeita um .pptx que não é zip", async () => {
    await expect(extractDocument(Buffer.from("não é zip"), "fake.pptx")).rejects.toThrow(/Office/i);
  });
});
