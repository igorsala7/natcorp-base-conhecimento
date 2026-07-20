"use client";

import { useMemo, type Dispatch, type SetStateAction } from "react";
import type { Block, BlockType } from "@/lib/blocks/schema";
import { newId } from "@/lib/blocks/schema";
import { BLOCKS } from "@/lib/blocks/registry.meta";
import { blocksToText } from "@/lib/blocks/serialize";
import {
  patchBlock,
  removeBlock,
  insertAfter,
  appendChild,
  duplicateBlock,
  updateBlock,
  nudgeBlock,
} from "@/lib/blocks/tree-ops";
import type { EditorActions } from "./edit-types";

/** Converte um bloco para outro tipo, preservando o texto quando possível. */
export function changeType(block: Block, type: BlockType): Block {
  const base = { ...BLOCKS[type].defaultData(), id: block.id } as Block;
  const srcText = "text" in block && block.text.length ? block.text : undefined;
  const fallback =
    !srcText && "children" in block ? [{ text: blocksToText(block.children ?? []) }] : undefined;
  const text = srcText ?? fallback;
  if (text && "text" in base) return { ...base, text } as Block;
  if (srcText && "children" in base)
    return { ...base, children: [{ id: newId(), type: "paragraph", text: srcText }] } as Block;
  return base;
}

/**
 * A API de mutação que cada bloco enxerga. Extraída do editor de página para
 * que o editor inline da prévia use exatamente a mesma — se as duas telas
 * divergissem aqui, "inserir bloco" passaria a significar coisas diferentes
 * dependendo de onde se está editando.
 *
 * Referencialmente estável (deps `[]`): só chama setters e `tree-ops`.
 */
export function useEditorActions({
  setBlocks,
  setSelectedId,
  setAutoFocusId,
  setSlash,
}: {
  setBlocks: Dispatch<SetStateAction<Block[]>>;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  setAutoFocusId: Dispatch<SetStateAction<string | null>>;
  setSlash: Dispatch<SetStateAction<{ id: string | null; rect: DOMRect } | null>>;
}): EditorActions {
  return useMemo<EditorActions>(
    () => ({
      patch: (id, patch) => setBlocks((bs) => patchBlock(bs, id, patch)),
      insertAfter: (id, type) => {
        const nb = BLOCKS[type].defaultData();
        setBlocks((bs) => insertAfter(bs, id, nb));
        setAutoFocusId(nb.id);
        setSelectedId(nb.id);
      },
      addChild: (parentId, type) => {
        const nb = BLOCKS[type].defaultData();
        setBlocks((bs) => appendChild(bs, parentId, nb));
        setAutoFocusId(nb.id);
        setSelectedId(nb.id);
      },
      remove: (id) =>
        setBlocks((bs) => {
          const next = removeBlock(bs, id);
          // Documento nunca fica sem bloco nenhum: sem um parágrafo vazio não
          // haveria onde clicar para voltar a escrever.
          return next.length ? next : [{ id: newId(), type: "paragraph", text: [] }];
        }),
      duplicate: (id) => setBlocks((bs) => duplicateBlock(bs, id)),
      transform: (id, type) => {
        setBlocks((bs) => updateBlock(bs, id, (b) => changeType(b, type)));
        setAutoFocusId(id);
      },
      transformHeading: (id, level) => {
        setBlocks((bs) =>
          updateBlock(bs, id, (b) => {
            const h = changeType(b, "heading");
            return { ...h, data: { level } } as Block;
          }),
        );
        setAutoFocusId(id);
      },
      move: (id, dir) => setBlocks((bs) => nudgeBlock(bs, id, dir)),
      select: (id) => setSelectedId(id),
      openSlash: (id, rect) => setSlash({ id, rect }),
    }),
    [setBlocks, setSelectedId, setAutoFocusId, setSlash],
  );
}
