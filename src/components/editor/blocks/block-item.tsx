"use client";

import { Fragment, memo } from "react";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, Copy, GripVertical, Trash2 } from "lucide-react";
import type { Block } from "@/lib/blocks/schema";
import { styleClass } from "@/lib/blocks/styles";
import { ICON_IN_TITLE } from "@/lib/blocks/icons";
import { BLOCKS } from "@/lib/blocks/registry.meta";
import { BlockIcon } from "./block-icon";
import { EDITORS } from "./registry.edit";
import { BlockMenu } from "./block-menu";
import type { EditorActions } from "./edit-types";

type ItemProps = {
  block: Block;
  actions: EditorActions;
  selectedIds: string[];
  autoFocusId: string | null;
  spaceId: string;
  /** Abre o menu de contexto (botão direito) para este bloco. */
  onContextMenu: (block: Block, x: number, y: number) => void;
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
  selectedIds,
  autoFocusId,
  spaceId,
  onContextMenu,
  depth = 0,
}: ItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const Editor = EDITORS[block.type];
  const Meta = BLOCKS[block.type];
  const selected = selectedIds.includes(block.id);
  const kids = childrenOf(block);

  const childrenNode = kids ? (
    <BlockList
      blocks={kids}
      actions={actions}
      selectedIds={selectedIds}
      autoFocusId={autoFocusId}
      spaceId={spaceId}
      onContextMenu={onContextMenu}
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
      className={`block-row group relative ${isDragging ? "z-30" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        // Shift/Ctrl/Cmd+clique alterna a seleção múltipla (para agrupar).
        if (e.shiftKey || e.metaKey || e.ctrlKey) {
          actions.selectToggle(block.id);
          // Limpa o realce de texto que o shift+clique cria no navegador — a
          // seleção de BLOCOS tem seu próprio destaque, e um texto realçado
          // faria o Ctrl+C/X cair no copiar nativo em vez de copiar os blocos.
          window.getSelection()?.removeAllRanges();
        } else actions.select(block.id);
      }}
      onContextMenu={(e) => {
        // Botão direito: seleciona ESTE bloco (o mais interno) e abre suas ações.
        e.preventDefault();
        e.stopPropagation();
        actions.select(block.id);
        onContextMenu(block, e.clientX, e.clientY);
      }}
    >
      <div
        className="block-handle absolute -left-7 top-1/2 flex -translate-y-1/2 items-center"
        // Selecionado também mostra a alça (o CSS de hover em globals tem
        // especificidade maior que utilitária — daí o estilo inline).
        style={selected ? { opacity: 1 } : undefined}
      >
        <button
          type="button"
          aria-label="Arrastar bloco"
          className="flex h-7 w-5 cursor-grab items-center justify-center rounded-sm text-border-strong transition-colors hover:bg-surface-2 hover:text-text active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <BlockMenu block={block} actions={actions} />
      </div>

      {/* Pill de controle: invisível em repouso, aparece no HOVER do cartão e
          fica fixa no selecionado (catálogo Lumina). */}
      <div
        className={`absolute z-20 flex items-center gap-0.5 rounded-md border border-border bg-surface p-0.5 shadow-2 transition-opacity ${
          depth > 0 ? "right-1 top-1" : "-top-3 right-3"
        } ${
          selected
            ? "opacity-100"
            : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
          <span className="flex items-center gap-1 px-1.5 text-2xs font-bold uppercase tracking-[0.05em] text-text-muted">
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
          <BarBtn
            title="Excluir (⌘⇧⌫)"
            danger
            onClick={() => actions.remove(block.id)}
          >
            <Trash2 className="size-3.5" />
          </BarBtn>
      </div>

      <div
        // Chrome do cartão (catálogo Lumina) vive NESTE wrapper externo; o
        // styleClass do bloco fica no div interno limpo logo abaixo. Misturar
        // os dois era o bug de "propriedade não aplica": bg/borda do cartão
        // venciam a cascata sobre a escolha do usuário.
        className={`rounded-lg border px-4 py-2 transition-all ${
          isDragging
            ? "border-brand-purple-400 opacity-90 shadow-2"
            : selected
              ? "border-brand-purple-300 bg-surface shadow-2 ring-2 ring-brand-purple-100 dark:ring-brand-purple-900"
              : "border-transparent hover:border-border hover:bg-surface hover:shadow-1"
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
      </div>
    </Wrapper>
  );
});

export function BlockList({
  blocks,
  actions,
  selectedIds,
  autoFocusId,
  spaceId,
  onContextMenu,
  depth = 0,
  dropLinha,
}: {
  blocks: Block[];
  actions: EditorActions;
  selectedIds: string[];
  autoFocusId: string | null;
  spaceId: string;
  onContextMenu: (block: Block, x: number, y: number) => void;
  depth?: number;
  /** Linha de inserção (arrasto da paleta) — só no nível raiz. */
  dropLinha?: { id: string; abaixo: boolean } | null;
}) {
  return (
    <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
      {blocks.map((b) => {
        const linha = depth === 0 && dropLinha?.id === b.id ? dropLinha : null;
        return (
          <Fragment key={b.id}>
            {linha && !linha.abaixo && <LinhaDrop />}
            <BlockItem
              block={b}
              actions={actions}
              selectedIds={selectedIds}
              autoFocusId={autoFocusId}
              spaceId={spaceId}
              onContextMenu={onContextMenu}
              depth={depth}
            />
            {linha && linha.abaixo && <LinhaDrop />}
          </Fragment>
        );
      })}
    </SortableContext>
  );
}

/** A linha que mostra ONDE o bloco arrastado da paleta vai entrar. */
function LinhaDrop() {
  return <div aria-hidden className="my-0.5 h-1 rounded-full bg-primary" />;
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
      className={`flex size-6 items-center justify-center rounded-sm text-text-muted transition-colors ${
        danger
          ? "hover:bg-danger-soft hover:text-danger"
          : "hover:bg-surface-2 hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}
