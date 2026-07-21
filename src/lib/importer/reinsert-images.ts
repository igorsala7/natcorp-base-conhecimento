import { newId, type Block, type BlockDoc } from "@/lib/blocks/schema";
import { blocksToText } from "@/lib/blocks/serialize";

/**
 * Reinserção das imagens no lugar dos marcadores ⟦IMG:n⟧ que a IA preservou.
 *
 * REGRA DE TAMANHO (pedido do usuário, 21/07): imagem NUNCA entra em região
 * menor que a largura da página — no documento original ela é grande, e
 * espremê-la numa coluna/painel a torna ilegível. Marcador que a IA deixou
 * DENTRO de um contêiner é IÇADO: a imagem sai em largura total logo APÓS o
 * contêiner, na ordem em que aparecia. Contêiner que só continha imagens
 * (ex.: coluna cuja única célula era o print) é descartado — sobraria vazio.
 *
 * Puro e sem `server-only` de propósito: o comportamento é garantido por
 * teste (`reinsert-images.test.ts`), não só pelo prompt.
 */

export type ImageRef = { src: string; alt: string; caption: string };

const IMG_TOKEN = "⟦IMG:";
const IMG_RE = /⟦IMG:(\d+)⟧/g;

function imgBlock(im: ImageRef): Block {
  return { id: newId(), type: "image", data: { src: im.src, alt: im.alt, caption: im.caption } };
}

/** Remove os marcadores ⟦IMG:n⟧ do texto de um bloco; retorna null se ficar vazio. */
function stripTokens(block: Block): Block | null {
  if (!("text" in block)) return block;
  const text = block.text
    .map((s) => ({ ...s, text: s.text.replace(IMG_RE, "") }))
    .filter((s) => s.text.length > 0);
  if (!text.map((s) => s.text).join("").trim()) return null;
  return { ...block, text } as Block;
}

function indicesDe(texto: string): number[] {
  return [...texto.matchAll(IMG_RE)].map((m) => Number(m[1]));
}

export function reinsertImages(doc: BlockDoc, images: ImageRef[]): BlockDoc {
  const placed = new Set<number>();
  const emitir = (i: number, out: Block[]) => {
    const im = images[i];
    if (im?.src && !placed.has(i)) {
      placed.add(i);
      out.push(imgBlock(im));
    }
  };

  // Limpa marcadores DENTRO de um contêiner, coletando os índices achados —
  // as imagens correspondentes sobem para o nível da página.
  const icar = (list: Block[], achados: number[]): Block[] =>
    list.flatMap((b) => {
      if ("children" in b && b.children?.length) {
        return [{ ...b, children: icar(b.children, achados) } as Block];
      }
      const texto = "text" in b ? blocksToText([b]) : "";
      if (!texto.includes(IMG_TOKEN)) return [b];
      achados.push(...indicesDe(texto));
      const limpo = stripTokens(b);
      return limpo && blocksToText([limpo]).trim() ? [limpo] : [];
    });

  const blocks: Block[] = [];
  for (const block of doc.blocks) {
    if ("children" in block && block.children?.length) {
      const achados: number[] = [];
      const limpo = { ...block, children: icar(block.children, achados) } as Block;
      // Contêiner que era SÓ imagem fica oco depois do içamento — descarta a
      // casca e deixa as imagens em largura total no lugar dele.
      if (blocksToText([limpo]).trim()) blocks.push(limpo);
      for (const i of achados) emitir(i, blocks);
      continue;
    }
    const texto = "text" in block ? blocksToText([block]) : "";
    if (!texto.includes(IMG_TOKEN)) {
      blocks.push(block);
      continue;
    }
    const indices = indicesDe(texto);
    const limpo = stripTokens(block);
    if (limpo && blocksToText([limpo]).trim()) blocks.push(limpo);
    for (const i of indices) emitir(i, blocks);
  }

  // Rede de segurança: imagem que a IA esqueceu volta ao final do artigo.
  images.forEach((im, i) => {
    if (im?.src && !placed.has(i)) blocks.push(imgBlock(im));
  });

  return {
    version: 2,
    blocks: blocks.length ? blocks : [{ id: newId(), type: "paragraph", text: [] }],
  };
}
