"use client";

import { memo } from "react";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, Copy, GripVertical, Settings2, Trash2 } from "lucide-react";
import type { Block } from "@/lib/blocks/schema";
import { styleClass } from "@/lib/blocks/styles";
import { ICON_IN_TITLE } from "@/lib/blocks/icons";
import { BLOCKS } from "@/lib/blocks/registry.meta";
import { BlockIcon } from "./block-icon";
import { EDITORS } from "./registry.edit";
import { BlockMenu } from "./block-menu";
import { BlockPropertiesForm } from "./properties-panel";
import type { EditorActions } from "./edit-types";

type ItemProps = {
  block: Block;
  actions: EditorActions;
  selectedId: string | null;
  autoFocusId: string | null;
  spaceId: string;
  /** Abre o menu de contexto (botão direito) para este bloco. */
  onContextMenu: (block: Block, x: number, y: number) => void;
  /** Alterna o formulário de Propriedades no cartão — quando o dono oferece. */
  onProperties?: () => void;
  /** Formulário de propriedades visível no bloco selecionado. */
  propsAberto?: boolean;
  /** Profundidade na árvore: filhos usam a barra de controle INTERNA (a
   *  externa seria cortada por wrappers com overflow-hidden). */
  depth?: number;
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
  onProperties,
  propsAberto = false,
  depth = 0,
}: ItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const Editor = EDITORS[block.type];
  const Meta = BLOCKS[block.type];
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
      onProperties={onProperties}
      propsAberto={propsAberto}
      depth={depth + 1}
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

      {selected && (
        <div
          className={`absolute z-20 flex items-center gap-0.5 rounded-md border border-border bg-surface p-0.5 shadow-2 ${
            depth > 0 ? "right-1 top-1" : "-top-3 right-2"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="flex items-center gap-1 px-1.5 text-[0.625rem] font-bold uppercase tracking-wide text-text-muted">
            <Meta.icon className="size-3.5" />
            {Meta.label}
          </span>
          <span className="mx-0.5 h-4 w-px bg-border" />
          <BarBtn title="Mover para cima (⌥⇧↑)" onClick={() => actions.move(block.id, -1)}>
            <ArrowUp className="size-3.5" />
          </BarBtn>
          <BarBtn title="Mover para baixo (⌥⇧↓)" onClick={() => actions.move(block.id, 1)}>
            <ArrowDown className="size-3.5" />
          </BarBtn>
          <BarBtn title="Duplicar (⌘D)" onClick={() => actions.duplicate(block.id)}>
            <Copy className="size-3.5" />
          </BarBtn>
          {onProperties && (
            <BarBtn title="Propriedades do bloco" onClick={onProperties}>
              <Settings2 className="size-3.5" />
            </BarBtn>
          )}
          <BarBtn
            title="Excluir (⌘⇧⌫)"
            danger
            onClick={() => actions.remove(block.id)}
          >
            <Trash2 className="size-3.5" />
          </BarBtn>
        </div>
      )}

      <div
        // Chrome do cartão: SÓ ring + sombra — utilitárias que NÃO disputam
        // fundo/borda/raio/padding com o styleClass do bloco (a disputa era o
        // bug de "propriedade não aplica": bg-surface/border-* do cartão
        // venciam a cascata sobre a escolha do usuário).
        className={`rounded-md px-1 py-0.5 transition-all ${
          selected
            ? "shadow-2 ring-2 ring-brand-purple-300 dark:ring-brand-purple-700"
            : "hover:shadow-1 hover:ring-1 hover:ring-border"
        }`}
      >
      <div className={styleClass(block.styles) || undefined}>
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
      {selected && propsAberto && (
        /* Faixa de propriedades DENTRO do cartão (padrão da referência):
           a prévia acima atualiza a cada mudança. */
        <div
          className="not-prose mt-2 rounded-md border border-border bg-surface-2 px-4 py-4"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="mb-3 text-[0.625rem] font-bold uppercase tracking-wide text-text-muted">
            Propriedades — {Meta.label}
          </p>
          <BlockPropertiesForm block={block} actions={actions} />
        </div>
      )}
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
  onProperties,
  propsAberto = false,
  depth = 0,
}: {
  blocks: Block[];
  actions: EditorActions;
  selectedId: string | null;
  autoFocusId: string | null;
  spaceId: string;
  onContextMenu: (block: Block, x: number, y: number) => void;
  onProperties?: () => void;
  propsAberto?: boolean;
  depth?: number;
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
          onProperties={onProperties}
          propsAberto={propsAberto}
          depth={depth}
        />
      ))}
    </SortableContext>
  );
}

/** Botão 24px da barra de controle flutuante. */
function BarBtn({
  title,
  onClick,
  danger,
  children,
}: {
  title: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex size-6 items-center justify-center rounded text-text-muted transition-colors ${
        danger
          ? "hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
          : "hover:bg-surface-2 hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}
