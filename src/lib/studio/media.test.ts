import { describe, it, expect } from "vitest";
import { resolverMidias, midiaParaBloco, type MediaRef } from "./media";
import { newId, type Block } from "@/lib/blocks/schema";

function par(texto: string): Block {
  return { id: newId(), type: "paragraph", text: [{ text: texto }] } as Block;
}
function textoDe(b: Block): string {
  return ((b as { text?: { text: string }[] }).text ?? []).map((s) => s.text).join("");
}

const img: MediaRef = { id: "abc", kind: "image", url: "https://x/assets/a.png", name: "a.png", alt: "Diagrama" };
const arq: MediaRef = { id: "def", kind: "file", url: "https://x/assets/m.pdf", name: "Manual.pdf", size: 1234 };

describe("midiaParaBloco", () => {
  it("imagem vira bloco image com src/alt", () => {
    const b = midiaParaBloco(img);
    expect(b.type).toBe("image");
    expect((b as { data: { src: string; alt: string } }).data).toMatchObject({ src: img.url, alt: "Diagrama" });
  });
  it("arquivo vira bloco file com url/name/size", () => {
    const b = midiaParaBloco(arq);
    expect(b.type).toBe("file");
    expect((b as { data: { url: string; name: string; size: number } }).data).toMatchObject({
      url: arq.url,
      name: "Manual.pdf",
      size: 1234,
    });
  });
});

describe("resolverMidias", () => {
  it("sem mídias → não altera nada", () => {
    const blocks = [par("Olá"), par("Mundo")];
    expect(resolverMidias(blocks, [])).toBe(blocks);
  });

  it("troca o marcador pelo bloco no lugar onde a IA o pôs", () => {
    const blocks = [par("Introdução."), par("[[media:abc]]"), par("Fim.")];
    const out = resolverMidias(blocks, [img]);
    // parágrafo só-marcador some, dá lugar à imagem
    expect(out.map((b) => b.type)).toEqual(["paragraph", "image", "paragraph"]);
    expect(textoDe(out[0]!)).toBe("Introdução.");
    expect(textoDe(out[2]!)).toBe("Fim.");
  });

  it("marcador no meio de um texto: mantém o texto (sem o token) e insere a mídia após", () => {
    const out = resolverMidias([par("Veja o anexo [[media:def]] para detalhes.")], [arq]);
    expect(out.map((b) => b.type)).toEqual(["paragraph", "file"]);
    expect(textoDe(out[0]!)).toBe("Veja o anexo  para detalhes.");
  });

  it("mídia não posicionada pela IA vai para o fim", () => {
    const out = resolverMidias([par("Corpo sem marcador.")], [img, arq]);
    expect(out.map((b) => b.type)).toEqual(["paragraph", "image", "file"]);
  });

  it("marcador de id desconhecido é apenas removido", () => {
    const out = resolverMidias([par("[[media:zzz]]"), par("texto")], [img]);
    // zzz some; img (não posicionada) vai ao fim
    expect(out.map((b) => b.type)).toEqual(["paragraph", "image"]);
    expect(textoDe(out[0]!)).toBe("texto");
  });

  it("é idempotente: rodar de novo não duplica a mídia já presente", () => {
    const uma = resolverMidias([par("[[media:abc]]")], [img]);
    const duas = resolverMidias(uma, [img]);
    expect(duas.filter((b) => b.type === "image")).toHaveLength(1);
    expect(duas).toEqual(uma);
  });

  it("não duplica quando a mídia já é um bloco no doc e ainda há o marcador", () => {
    const jaTem: Block = midiaParaBloco(img);
    const out = resolverMidias([jaTem, par("[[media:abc]]")], [img]);
    expect(out.filter((b) => b.type === "image")).toHaveLength(1);
  });
});
