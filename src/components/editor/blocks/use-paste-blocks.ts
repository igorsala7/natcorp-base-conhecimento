"use client";

import { useCallback } from "react";
import type { ClipboardEvent } from "react";
import type { Block } from "@/lib/blocks/schema";
import { htmlToBlocks, textToBlocks, imageBlock } from "@/lib/blocks/from-html";
import { uploadToAssets } from "@/lib/content/upload";

type ImageBlock = Extract<Block, { type: "image" }>;

/**
 * Handler de COLAR para o editor de blocos: interpreta o conteúdo da área de
 * transferência (Word, Google Docs, páginas web, imagens) e o converte nos
 * blocos nativos, inserindo no ponto do cursor.
 *
 * Fica no container do editor (o evento borbulha do contentEditable do bloco):
 * um só handler cobre os dois shells (página e embutido). Texto simples de uma
 * linha NÃO é interceptado — segue o colar nativo, para não quebrar a digitação
 * no meio de uma frase.
 */
export function usePasteBlocks({
  spaceId,
  insertBlocks,
  patch,
}: {
  spaceId: string;
  insertBlocks: (afterId: string | null, blocks: Block[]) => void;
  patch: (id: string, patch: Partial<Block>) => void;
}) {
  return useCallback(
    (e: ClipboardEvent) => {
      // Só interceptamos o colar DENTRO do texto de um bloco (contentEditable).
      // Colar num <input>/<textarea> (título, código, legenda) segue nativo.
      const alvo = alvoEditor();
      if (!alvo.ok) return;
      const cd = e.clipboardData;
      if (!cd) return;
      const html = cd.getData("text/html");
      const text = cd.getData("text/plain");
      const arquivosImagem = Array.from(cd.items ?? [])
        .filter((it) => it.kind === "file" && it.type.startsWith("image/"))
        .map((it) => it.getAsFile())
        .filter((f): f is File => !!f);

      // 1) Só imagem (captura de tela / imagem única, sem HTML rico).
      if (!html.trim() && arquivosImagem.length) {
        e.preventDefault();
        const blocos = arquivosImagem.map(() => imageBlock(""));
        insertBlocks(alvo.id, blocos);
        arquivosImagem.forEach((file, i) => {
          const bloco = blocos[i];
          if (!bloco) return;
          void uploadToAssets(file, spaceId).then((url) => {
            if (url) patch(bloco.id, { data: { src: url, alt: "", caption: "" } } as Partial<Block>);
          });
        });
        return;
      }

      // 2) HTML rico (Word/Docs/web) ou texto multi-linha.
      let blocos: Block[] = [];
      if (html.trim()) blocos = htmlToBlocks(html);
      if (!blocos.length && /\r?\n/.test(text.trim())) blocos = textToBlocks(text);
      // Nada estruturado: deixa o colar nativo (texto simples de 1 linha).
      if (!blocos.length) return;

      e.preventDefault();
      insertBlocks(alvo.id, blocos);
      reidratarImagens(blocos, spaceId, patch);
    },
    [spaceId, insertBlocks, patch],
  );
}

/**
 * Verifica se o foco está no texto editável de um bloco e devolve o id do
 * bloco de TOPO (ancestral raiz). Recusa (`ok:false`) quando o foco está fora
 * do canvas ou num campo de formulário — aí o colar nativo prevalece.
 *
 * Usa o bloco de topo (não o mais interno) de propósito: colar dentro de um
 * item de lista ou coluna inseriria parágrafo/tabela onde o schema não permite;
 * no nível raiz o resultado é sempre válido e previsível.
 */
function alvoEditor(): { ok: boolean; id: string | null } {
  const el = typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null;
  if (!el || !el.isContentEditable) return { ok: false, id: null };
  let node: Element | null = el.closest("[data-block-id]");
  let topo: string | null = null;
  while (node) {
    topo = node.getAttribute("data-block-id");
    node = node.parentElement?.closest("[data-block-id]") ?? null;
  }
  return { ok: true, id: topo };
}

/** Re-hospeda no bucket `assets` as imagens que vieram como data: URI. */
function reidratarImagens(
  blocos: Block[],
  spaceId: string,
  patch: (id: string, patch: Partial<Block>) => void,
): void {
  for (const img of coletarImagens(blocos)) {
    if (!img.data.src.startsWith("data:")) continue; // http(s) já persiste
    const file = dataUrlParaFile(img.data.src, `colado-${img.id}`);
    if (!file) continue;
    void uploadToAssets(file, spaceId).then((url) => {
      if (url) patch(img.id, { data: { ...img.data, src: url } } as Partial<Block>);
    });
  }
}

function coletarImagens(blocos: Block[]): ImageBlock[] {
  const out: ImageBlock[] = [];
  const visitar = (bs: Block[]) => {
    for (const b of bs) {
      if (b.type === "image") out.push(b);
      const ch = "children" in b ? (b.children as Block[] | undefined) : undefined;
      if (ch) visitar(ch);
    }
  };
  visitar(blocos);
  return out;
}

/** `data:[mime];base64,....` → File (para o upload ao Storage). */
function dataUrlParaFile(dataUrl: string, nome: string): File | null {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!m) return null;
  const mime = m[1] || "image/png";
  const dados = m[3] ?? "";
  try {
    const bruto = m[2] ? atob(dados) : decodeURIComponent(dados);
    const bytes = new Uint8Array(bruto.length);
    for (let i = 0; i < bruto.length; i++) bytes[i] = bruto.charCodeAt(i);
    const ext = (mime.split("/")[1] || "png").replace(/\+.*$/, "");
    return new File([bytes], `${nome}.${ext}`, { type: mime });
  } catch {
    return null;
  }
}
