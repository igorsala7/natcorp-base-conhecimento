import { describe, it, expect } from "vitest";
import { segmentarTexto, contarPalavras } from "./segment";

/** Reconstrói o texto a partir dos segmentos, como a leitura humana faria. */
const juntar = (segs: string[]) => segs.join("\n\n");

describe("segmentarTexto", () => {
  it("texto vazio não gera segmento", () => {
    expect(segmentarTexto("")).toEqual([]);
    expect(segmentarTexto("   \n\n  ")).toEqual([]);
  });

  it("texto abaixo do limite fica em um segmento só", () => {
    const t = "Um parágrafo.\n\nOutro parágrafo.";
    expect(segmentarTexto(t, 1000)).toEqual([t]);
  });

  it("NÃO perde nenhuma palavra ao dividir — o bug que motivou o módulo", () => {
    const paragrafos = Array.from({ length: 60 }, (_, i) => `Parágrafo número ${i} com algum conteúdo de texto.`);
    const texto = paragrafos.join("\n\n");
    const segs = segmentarTexto(texto, 300);

    expect(segs.length).toBeGreaterThan(1);
    expect(contarPalavras(juntar(segs))).toBe(contarPalavras(texto));
    // E na ordem original.
    expect(juntar(segs)).toBe(texto);
  });

  it("respeita o limite quando os parágrafos cabem", () => {
    const texto = Array.from({ length: 40 }, () => "a".repeat(90)).join("\n\n");
    for (const s of segmentarTexto(texto, 500)) {
      expect(s.length).toBeLessThanOrEqual(500);
    }
  });

  it("nunca corta no meio de um parágrafo", () => {
    const texto = ["curto", "b".repeat(200), "outro curto"].join("\n\n");
    const segs = segmentarTexto(texto, 120);
    // O parágrafo gigante aparece inteiro em algum segmento.
    expect(segs.some((s) => s.includes("b".repeat(200)))).toBe(true);
  });

  it("parágrafo maior que o limite vira segmento próprio inteiro (não trunca)", () => {
    const gigante = "palavra ".repeat(400).trim();
    const segs = segmentarTexto(gigante, 100);
    expect(segs).toHaveLength(1);
    expect(segs[0]).toBe(gigante);
  });
});

describe("contarPalavras", () => {
  it("ignora marcadores de imagem", () => {
    expect(contarPalavras("antes ⟦IMG:0⟧ depois")).toBe(2);
  });

  it("ignora pontuação solta", () => {
    expect(contarPalavras("uma — duas  ...  três")).toBe(3);
  });

  it("conta acentuadas e números", () => {
    expect(contarPalavras("configuração 42 ação")).toBe(3);
  });
});
