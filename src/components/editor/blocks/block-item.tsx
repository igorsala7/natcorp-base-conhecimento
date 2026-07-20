"use client";

import { memo } from "react";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { Block } from "@/lib/blocks/schema";
import { styleClass } from "@/lib/blocks/styles";
import { ICON_IN_TITLE } from "@/lib/blocks/icons";
import { BlockIcon } from "./block-icon";
import { EDITORS } from "./registry.edit";
import { BlockMenu } from "./block-menu";
import type { EditorActions } from "./edit-types";

type ItemProps = {
  block: Block;
  actions: EditorActions;
  selectedId: string | null;
  autoFocusId: string | null;
  spaceId: string;
  /** Abre o menu de contexto (botão direito) para este bloco. */
  onContextMenu: (block: Block, x: number, y: number) => void;
};

function childrenOf(block: Block): Block[] | undefined {
  return "children" in block ? (block.children as Block[] | undefined) : undefined;
}

const BlockItem = memo(function BlockItem({
  block,
  actions,
  selectedId,
  autoFocusId,
  spaceId,
  onContextMenu,
}: ItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const Editor = EDITORS[block.type];
  const selected = selectedId === block.id;
  const kids = childrenOf(block);

  const childrenNode = kids ? (
    <BlockList
      blocks={kids}
      actions={actions}
      selectedId={selectedId}
      autoFocusId={autoFocusId}
      spaceId={spaceId}
      onContextMenu={onContextMenu}
    />
  ) : undefined;

  // Itens de lista usam <li> real (dentro do <ul>/<ol>) para o marcador do
  // `.prose` aparecer igual ao portal.
  const Wrapper = (block.type === "listItem" ? "li" : "div") as "li" | "div";

  return (
    <Wrapper
      ref={setNodeRef}
      data-block-id={block.id}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`block-row group relative ${isDragging ? "opacity-40" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        actions.select(block.id);
      }}
      onContextMenu={(e) => {
        // Botão direito: seleciona ESTE bloco (o mais interno) e abre suas ações.
        e.preventDefault();
        e.stopPropagation();
        actions.select(block.id);
        onContextMenu(block, e.clientX, e.clientY);
      }}
    >
      <div className="block-handle absolute -left-11 top-0 flex items-center">
        <button
          type="button"
          aria-label="Arrastar bloco"
          className="flex size-6 cursor-grab items-center justify-center rounded text-text-muted hover:bg-surface-2 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <BlockMenu block={block} actions={actions} />
      </div>

      <div className={`rounded-md px-1 py-0.5 ${selected ? "ring-1 ring-primary/40" : ""} ${styleClass(block.styles)}`}>
        {/* Ícone da região — os blocos com título o desenham junto do título. */}
        {!ICON_IN_TITLE.has(block.type) && (
          <BlockIcon name={block.styles?.icon} className="mb-2 size-5 text-primary" />
        )}
        <Editor
          block={block}
          spaceId={spaceId}
          autoFocus={autoFocusId === block.id}
          onChange={(patch) => actions.patch(block.id, patch)}
          onEnter={() => actions.insertAfter(block.id, "paragraph")}
          onEmptyBackspace={() => actions.remove(block.id)}
          onSlash={(rect) => actions.openSlash(block.id, rect)}
        >
          {childrenNode}
        </Editor>
      </div>
    </Wrapper>
  );
});

export function BlockList({
  blocks,
  actions,
  selectedId,
  autoFocusId,
  spaceId,
  onContextMenu,
}: {
  blocks: Block[];
  actions: EditorActions;
  selectedId: string | null;
  autoFocusId: string | null;
  spaceId: string;
  onContextMenu: (block: Block, x: number, y: number) => void;
}) {
  return (
    <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
      {blocks.map((b) => (
        <BlockItem
          key={b.id}
          block={b}
          actions={actions}
          selectedId={selectedId}
          autoFocusId={autoFocusId}
          spaceId={spaceId}
          onContextMenu={onContextMenu}
        />
      ))}
    </SortableContext>
  );
}
