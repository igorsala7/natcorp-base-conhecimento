import { describe, it, expect } from "vitest";
import { newId, type Block, type BlockDoc } from "@/lib/blocks/schema";
import { reinsertImages, type ImageRef } from "./reinsert-images";

const IMG: ImageRef[] = [
  { src: "https://x/0.png", alt: "a", caption: "" },
  { src: "https://x/1.png", alt: "b", caption: "" },
];

function para(text: string): Block {
  return { id: newId(), type: "paragraph", text: text ? [{ text }] : [] };
}
function doc(blocks: Block[]): BlockDoc {
  return { version: 2, blocks };
}
const tipos = (d: BlockDoc) => d.blocks.map((b) => b.type);

describe("reinsertImages — imagem nunca fica menor que a largura da página", () => {
  it("marcador em parágrafo de topo vira imagem em largura total no lugar", () => {
    const out = reinsertImages(doc([para("Antes"), para("⟦IMG:0⟧"), para("Depois")]), IMG.slice(0, 1));
    expect(tipos(out)).toEqual(["paragraph", "image", "paragraph"]);
  });

  it("marcador DENTRO de coluna é içado: imagem sai APÓS o contêiner, no topo", () => {
    const colunas: Block = {
      id: newId(),
      type: "container",
      data: { columns: 2 },
      children: [
        { id: newId(), type: "column", children: [para("⟦IMG:0⟧")] },
        { id: newId(), type: "column", children: [para("Texto explicativo.")] },
      ],
    };
    const out = reinsertImages(doc([colunas, para("Fim")]), IMG.slice(0, 1));
    expect(tipos(out)).toEqual(["container", "image", "paragraph"]);
    // A imagem NÃO ficou dentro do contêiner.
    const container = out.blocks[0] as Extract<Block, { type: "container" }>;
    const dentro = JSON.stringify(container.children);
    expect(dentro).not.toContain('"image"');
    expect(dentro).not.toContain("⟦IMG:");
  });

  it("contêiner que era SÓ a imagem é descartado — sobra a imagem, não a casca", () => {
    const soImagem: Block = {
      id: newId(),
      type: "panel",
      data: { bg: "purple" },
      children: [para("⟦IMG:0⟧")],
    };
    const out = reinsertImages(doc([soImagem]), IMG.slice(0, 1));
    expect(tipos(out)).toEqual(["image"]);
  });

  it("imagem esquecida pela IA volta ao final; nenhuma se perde nem duplica", () => {
    const out = reinsertImages(doc([para("Só texto, marcador ⟦IMG:1⟧ de um.")]), IMG);
    expect(tipos(out)).toEqual(["paragraph", "image", "image"]);
    const srcs = out.blocks
      .filter((b): b is Extract<Block, { type: "image" }> => b.type === "image")
      .map((b) => b.data.src);
    expect(new Set(srcs).size).toBe(2);
  });
});
