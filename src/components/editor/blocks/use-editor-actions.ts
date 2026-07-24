"use client";

import { useMemo, type Dispatch, type SetStateAction } from "react";
import type { Block, BlockType, RichText } from "@/lib/blocks/schema";
import { newId } from "@/lib/blocks/schema";
import { BLOCKS } from "@/lib/blocks/registry.meta";
import { blocksToText, richToText } from "@/lib/blocks/serialize";
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

/** Junta várias linhas de RichText num só, separadas por quebra de linha. */
function juntarLinhas(linhas: RichText[]): RichText {
  const out: RichText = [];
  linhas.forEach((l, i) => {
    if (i > 0) out.push({ text: "\n" });
    out.push(...l);
  });
  return out;
}

/** Une as células de uma linha de tabela num só RichText. */
function juntarCelulas(row: RichText[]): RichText {
  const out: RichText = [];
  row.forEach((c, i) => {
    if (i > 0 && c.length) out.push({ text: "  " });
    out.push(...c);
  });
  return out;
}

/**
 * Extrai o conteúdo de QUALQUER bloco de texto como LINHAS de RichText (uma
 * entrada por item/linha). Preserva as marcas quando a origem já é RichText
 * (texto/título/citação/lista/checklist); tabela/código/contêiner viram texto.
 */
function linhasDe(block: Block): RichText[] {
  if ("text" in block) return block.text.length ? [block.text] : [];
  switch (block.type) {
    case "bulletList":
    case "orderedList":
      return (block.children ?? [])
        .filter((c): c is Extract<Block, { type: "listItem" }> => c.type === "listItem")
        .map((c) => c.text);
    case "checklist":
      return block.data.items.map((i) => i.text);
    case "table":
      return block.data.rows.map((row) => juntarCelulas(row));
    case "code":
      return block.data.code.split("\n").map((l) => (l ? [{ text: l }] : []));
    case "hero":
      return [block.data.eyebrow, block.data.title, block.data.subtitle]
        .map((t) => t?.trim())
        .filter((t): t is string => !!t)
        .map((t) => [{ text: t }]);
    default: {
      const txt = "children" in block ? blocksToText(block.children ?? []) : "";
      return txt ? txt.split("\n").map((l) => [{ text: l }]) : [];
    }
  }
}

const listItemDe = (text: RichText): Block => ({ id: newId(), type: "listItem", text }) as Block;
const paragrafoDe = (text: RichText): Block => ({ id: newId(), type: "paragraph", text }) as Block;
// Wrappers SÓ-FILHO dos layouts (o conteúdo entra num parágrafo dentro deles).
const stepDe = (text: RichText): Block => ({ id: newId(), type: "step", children: [paragrafoDe(text)] }) as Block;
const cardDe = (text: RichText): Block =>
  ({ id: newId(), type: "card", data: { icon: "", title: "", href: "" }, children: [paragrafoDe(text)] }) as Block;
const columnDe = (text: RichText): Block => ({ id: newId(), type: "column", children: [paragrafoDe(text)] }) as Block;

/** Converte um bloco para outro tipo, PRESERVANDO o conteúdo (só entre blocos de texto). */
export function changeType(block: Block, type: BlockType): Block {
  if (block.type === type) return block;

  // Lista ↔ checklist: item a item, preservando os ids (undo/estabilidade).
  if (block.type === "checklist" && (type === "bulletList" || type === "orderedList")) {
    return {
      id: block.id,
      type,
      children: block.data.items.map((i) => ({ id: i.id, type: "listItem" as const, text: i.text })),
    } as Block;
  }
  if ((block.type === "bulletList" || block.type === "orderedList") && type === "checklist") {
    const items = (block.children ?? [])
      .filter((c): c is Extract<Block, { type: "listItem" }> => c.type === "listItem")
      .map((c) => ({ id: c.id, text: c.text, checked: false }));
    return {
      id: block.id,
      type: "checklist" as const,
      data: { items: items.length ? items : [{ id: newId(), text: [], checked: false }] },
    } as Block;
  }

  const linhas = linhasDe(block);
  const base = { ...BLOCKS[type].defaultData(), id: block.id } as Block;

  if (type === "code") {
    return { ...base, data: { language: null, code: linhas.map(richToText).join("\n") } } as Block;
  }
  if (type === "table") {
    const rows = linhas.length ? linhas.map((l) => [l]) : [[[] as RichText]];
    return { ...base, data: { hasHeader: false, rows } } as Block;
  }
  if (type === "bulletList" || type === "orderedList") {
    return { ...base, children: (linhas.length ? linhas : [[]]).map(listItemDe) } as Block;
  }
  if (type === "checklist") {
    const items = (linhas.length ? linhas : [[]]).map((l) => ({ id: newId(), text: l, checked: false }));
    return { ...base, data: { items } } as Block;
  }
  // Layouts com filhos SÓ-FILHO (step/card/column) — o texto vai num parágrafo
  // dentro de cada wrapper. `hero` (void) recebe o texto em title/subtitle.
  if (type === "steps") return { ...base, children: (linhas.length ? linhas : [[]]).map(stepDe) } as Block;
  if (type === "cardGrid") return { ...base, children: (linhas.length ? linhas : [[]]).map(cardDe) } as Block;
  if (type === "container") {
    const cols = (linhas.length ? linhas : [[]]).map(columnDe);
    while (cols.length < 2) cols.push(columnDe([])); // "Colunas" exige ao menos 2
    return { ...base, data: { columns: cols.length }, children: cols } as Block;
  }
  if (type === "hero") {
    const title = richToText(linhas[0] ?? []) || "Título";
    const subtitle = linhas.slice(1).map(richToText).join(" ");
    return { ...base, data: { eyebrow: "", title, subtitle, bg: "purple" } } as Block;
  }
  if ("text" in base) return { ...base, text: juntarLinhas(linhas) } as Block;
  if ("children" in base) {
    // callout/toggle → parágrafos-filho, mantendo o data padrão (variante/título).
    return { ...base, children: (linhas.length ? linhas : [[]]).map(paragrafoDe) } as Block;
  }
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
