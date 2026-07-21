import { describe, it, expect } from "vitest";
import { extractDocument } from "./extract";
import { montarPdf, bitmapSolido } from "./pdf-fixture";
import { encodePng } from "./png";

/**
 * PDF nunca devolveu imagem nenhuma: `extractPdf` terminava com `images: []`.
 * Como o projeto vive de manuais em PDF cheios de print de tela, o teste usa um
 * PDF montado aqui — assim sabemos exatamente onde cada texto e cada imagem
 * foram desenhados e dá para afirmar se a ÂNCORA ficou certa.
 */
const VERMELHO = bitmapSolido(60, 40, [220, 30, 30]);
const AZUL = bitmapSolido(60, 40, [30, 30, 220]);

describe("extração de PDF", () => {
  it("traz a imagem e a ancora no texto que está acima dela", async () => {
    const pdf = montarPdf([
      {
        textos: [
          { texto: "Manual do Sistema", x: 72, y: 720, tamanho: 24 },
          { texto: "Antes da imagem", x: 72, y: 660, tamanho: 10 },
          { texto: "Depois da imagem", x: 72, y: 440, tamanho: 10 },
        ],
        // Base em y=480 e altura 150 → topo em 630, entre os dois parágrafos.
        imagens: [{ x: 72, y: 480, largura: 200, altura: 150, pixels: VERMELHO, pxLargura: 60, pxAltura: 40 }],
      },
    ]);

    const ex = await extractDocument(pdf, "manual.pdf", "application/pdf");
    expect(ex.source).toBe("pdf");
    expect(ex.blocks.map((b) => b.text)).toEqual([
      "Manual do Sistema",
      "Antes da imagem",
      "Depois da imagem",
    ]);
    expect(ex.images).toHaveLength(1);
    // Índice 1 = "Antes da imagem": a imagem entra logo depois dele.
    expect(ex.images[0]!.afterBlock).toBe(1);
    expect(ex.images[0]!.mime).toBe("image/png");
  });

  it("o PNG gerado tem o tamanho e a cor do bitmap original", async () => {
    const pdf = montarPdf([
      {
        textos: [{ texto: "Tela", x: 72, y: 700, tamanho: 10 }],
        imagens: [{ x: 72, y: 400, largura: 200, altura: 150, pixels: VERMELHO, pxLargura: 60, pxAltura: 40 }],
      },
    ]);
    const ex = await extractDocument(pdf, "x.pdf", "application/pdf");
    const png = Buffer.from(ex.images[0]!.contentBase64, "base64");

    expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    expect(png.readUInt32BE(16)).toBe(60); // largura do IHDR
    expect(png.readUInt32BE(20)).toBe(40); // altura
    // Mesmo bitmap → mesmo PNG: prova que os pixels chegaram intactos.
    expect(png.equals(encodePng(VERMELHO, 60, 40, 3))).toBe(true);
  });

  it("mantém a ordem de leitura entre páginas", async () => {
    const pdf = montarPdf([
      {
        textos: [{ texto: "Pagina um", x: 72, y: 700, tamanho: 10 }],
        imagens: [{ x: 72, y: 400, largura: 100, altura: 80, pixels: VERMELHO, pxLargura: 60, pxAltura: 40 }],
      },
      {
        textos: [{ texto: "Pagina dois", x: 72, y: 700, tamanho: 10 }],
        imagens: [{ x: 72, y: 400, largura: 100, altura: 80, pixels: AZUL, pxLargura: 60, pxAltura: 40 }],
      },
    ]);
    const ex = await extractDocument(pdf, "x.pdf", "application/pdf");
    expect(ex.blocks.map((b) => b.text)).toEqual(["Pagina um", "Pagina dois"]);
    expect(ex.images.map((i) => i.afterBlock)).toEqual([0, 1]);
    // A vermelha veio antes da azul.
    expect(ex.images[0]!.contentBase64).not.toBe(ex.images[1]!.contentBase64);
  });

  it("descarta o que é pequeno demais para ser conteúdo (espaçador, régua)", async () => {
    const pdf = montarPdf([
      {
        textos: [{ texto: "Texto", x: 72, y: 700, tamanho: 10 }],
        imagens: [
          { x: 72, y: 600, largura: 100, altura: 4, pixels: bitmapSolido(8, 2, [0, 0, 0]), pxLargura: 8, pxAltura: 2 },
          { x: 72, y: 400, largura: 100, altura: 80, pixels: VERMELHO, pxLargura: 60, pxAltura: 40 },
        ],
      },
    ]);
    const ex = await extractDocument(pdf, "x.pdf", "application/pdf");
    expect(ex.images).toHaveLength(1);
  });

  it("o logo repetido em toda página não vira conteúdo", async () => {
    const pagina = (n: number) => ({
      textos: [{ texto: `Pagina ${n}`, x: 72, y: 700, tamanho: 10 }],
      imagens: [{ x: 72, y: 740, largura: 80, altura: 30, pixels: AZUL, pxLargura: 60, pxAltura: 40 }],
    });
    const ex = await extractDocument(
      montarPdf([pagina(1), pagina(2), pagina(3), pagina(4)]),
      "x.pdf",
      "application/pdf",
    );
    expect(ex.images).toHaveLength(0);
    expect(ex.droppedChrome).toBe(4);
  });

  it("PDF sem imagem continua funcionando", async () => {
    const ex = await extractDocument(
      montarPdf([{ textos: [{ texto: "So texto", x: 72, y: 700, tamanho: 10 }] }]),
      "x.pdf",
      "application/pdf",
    );
    expect(ex.images).toEqual([]);
    expect(ex.blocks[0]!.text).toBe("So texto");
  });
});
