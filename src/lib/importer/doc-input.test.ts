import { describe, it, expect } from "vitest";
import { buildDocInput, extractionToTranscript, pageCount } from "./doc-input";
import type { Extraction } from "./extract";

function extr(over: Partial<Extraction> = {}): Extraction {
  return {
    source: "pdf",
    blocks: [
      { text: "Cadastros", level: 1, page: 1 },
      { text: "Área de atendimento define...", level: 0, page: 1 },
      { text: "Chamados", level: 1, page: 2 },
      { text: "Abrir um chamado...", level: 0, page: 2 },
    ],
    images: [{ name: "i0", contentBase64: "AAAA", mime: "image/png", afterBlock: 1 }],
    ...over,
  };
}

const buf = Buffer.from("%PDF-1.4 fake");
const stubRaster = async (_b: Buffer, o: { maxPages: number }) =>
  Array.from({ length: Math.min(3, o.maxPages) }, (_, i) => ({
    page: i + 1,
    png: new Uint8Array([i]),
  }));

describe("pageCount / transcript", () => {
  it("conta a maior página", () => {
    expect(pageCount(extr())).toBe(2);
    expect(pageCount(extr({ source: "html", blocks: [{ text: "x", level: 0 }] }))).toBe(0);
  });

  it("transcrição traz [Página N], títulos com # e marcador de imagem na posição", () => {
    const t = extractionToTranscript(extr());
    expect(t).toContain("[Página 1]");
    expect(t).toContain("# Cadastros");
    expect(t).toContain("⟦IMG:0⟧");
    // a imagem (afterBlock=1) vem depois do bloco 1
    expect(t.indexOf("⟦IMG:0⟧")).toBeGreaterThan(t.indexOf("Área de atendimento"));
  });
});

describe("buildDocInput", () => {
  it("Anthropic/Google com PDF → pdf-nativo (texto + arquivo)", async () => {
    for (const kind of ["anthropic", "google"] as const) {
      const d = await buildDocInput({ kind, buf, extraction: extr() });
      expect(d.modo).toBe("pdf-nativo");
      expect(d.parts[0]!.type).toBe("text");
      expect(d.parts[1]).toMatchObject({ type: "file", mediaType: "application/pdf" });
    }
  });

  it("OpenAI com PDF → imagens (texto + uma imagem por página)", async () => {
    const d = await buildDocInput({ kind: "openai", buf, extraction: extr(), rasterize: stubRaster });
    expect(d.modo).toBe("imagens");
    expect(d.parts.filter((p) => p.type === "image").length).toBe(3);
  });

  it("OpenAI sem rasterizador → texto", async () => {
    const d = await buildDocInput({ kind: "openai", buf, extraction: extr() });
    expect(d.modo).toBe("texto");
    expect(d.parts).toHaveLength(1);
  });

  it("PDF acima do limite de páginas → texto (não manda nativo)", async () => {
    const grande = extr({ blocks: [{ text: "fim", level: 0, page: 200 }] });
    const d = await buildDocInput({ kind: "anthropic", buf, extraction: grande });
    expect(d.modo).toBe("texto");
  });

  it("fonte não-PDF (HTML) → texto em qualquer provedor", async () => {
    const html = extr({ source: "html", blocks: [{ text: "oi", level: 0 }], images: [] });
    const d = await buildDocInput({ kind: "anthropic", buf, extraction: html });
    expect(d.modo).toBe("texto");
  });
});
