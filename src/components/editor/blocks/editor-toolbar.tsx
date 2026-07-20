"use client";

import {
  AlignLeft, Bold, Code2, Columns3, Copy, Eye, Heading1, Heading2,
  Heading3, Highlighter, Image as ImageIcon, Info, Italic, Keyboard, Link2, List,
  Redo2, Undo2,
  ListOrdered, Minus, MousePointerClick, Pencil, Plus, Quote, Settings2,
  Sparkles, Strikethrough, Table as TableIcon, Trash2, Video, type LucideIcon,
} from "lucide-react";
import type { BlockType, Mark } from "@/lib/blocks/schema";

type Props = {
  hasSelection: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  preview: boolean;
  onFormat: (mark: Mark["type"]) => void;
  onLink: () => void;
  onInsert: (type: BlockType) => void;
  onTransform: (type: BlockType) => void;
  onTransformHeading: (level: 1 | 2 | 3) => void;
  onMoreBlocks: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onProperties: () => void;
  onTogglePreview: () => void;
  onShortcuts: () => void;
};

/**
 * Barra de ferramentas do topo — deixa os recursos visíveis (em vez de
 * escondidos em atalhos/menus). Os botões usam onMouseDown+preventDefault para
 * NÃO tirar o foco do texto: sem isso, a seleção some antes de formatar.
 */
export function EditorToolbar({
  hasSelection,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  preview,
  onFormat,
  onLink,
  onInsert,
  onTransform,
  onTransformHeading,
  onMoreBlocks,
  onDuplicate,
  onDelete,
  onProperties,
  onTogglePreview,
  onShortcuts,
}: Props) {
  if (preview) {
    return (
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border py-1.5">
        <span className="px-2 text-xs text-text-muted">
          Pré-visualização — é exatamente o que o leitor vê.
        </span>
        <div className="ml-auto" />
        <Btn icon={Pencil} label="Voltar a editar" onClick={onTogglePreview} active />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto border-b border-border py-1.5">
      {/* Desfazer / refazer */}
      <Btn icon={Undo2} label="Desfazer (⌘Z)" disabled={!canUndo} onClick={onUndo} />
      <Btn icon={Redo2} label="Refazer (⌘⇧Z)" disabled={!canRedo} onClick={onRedo} />

      <Sep />

      {/* Formatação do texto (na seleção) */}
      <Btn icon={Bold} label="Negrito (⌘B)" onClick={() => onFormat("bold")} />
      <Btn icon={Italic} label="Itálico (⌘I)" onClick={() => onFormat("italic")} />
      <Btn icon={Strikethrough} label="Tachado (⌘⇧X)" onClick={() => onFormat("strike")} />
      <Btn icon={Code2} label="Código inline (⌘E)" onClick={() => onFormat("code")} />
      <Btn icon={Highlighter} label="Marca-texto (⌘⇧H)" onClick={() => onFormat("highlight")} />
      <Btn icon={Link2} label="Link (⌘K)" onClick={onLink} />

      <Sep />

      {/* Transformar o bloco selecionado */}
      <Btn icon={AlignLeft} label="Parágrafo (⌘⇧0)" disabled={!hasSelection} onClick={() => onTransform("paragraph")} />
      <Btn icon={Heading1} label="Título 1 (⌘⇧1)" disabled={!hasSelection} onClick={() => onTransformHeading(1)} />
      <Btn icon={Heading2} label="Título 2 (⌘⇧2)" disabled={!hasSelection} onClick={() => onTransformHeading(2)} />
      <Btn icon={Heading3} label="Título 3 (⌘⇧3)" disabled={!hasSelection} onClick={() => onTransformHeading(3)} />
      <Btn icon={List} label="Lista (⌘⇧8)" disabled={!hasSelection} onClick={() => onTransform("bulletList")} />
      <Btn icon={ListOrdered} label="Lista numerada (⌘⇧7)" disabled={!hasSelection} onClick={() => onTransform("orderedList")} />
      <Btn icon={Quote} label="Citação (⌘⇧9)" disabled={!hasSelection} onClick={() => onTransform("quote")} />

      <Sep />

      {/* Inserir recursos */}
      <Btn icon={ImageIcon} label="Inserir imagem" onClick={() => onInsert("image")} />
      <Btn icon={TableIcon} label="Inserir tabela" onClick={() => onInsert("table")} />
      <Btn icon={Code2} label="Inserir bloco de código" onClick={() => onInsert("code")} />
      <Btn icon={Info} label="Inserir destaque" onClick={() => onInsert("callout")} />
      <Btn icon={Columns3} label="Inserir região com divisões" onClick={() => onInsert("container")} />
      <Btn icon={Video} label="Inserir vídeo" onClick={() => onInsert("video")} />
      <Btn icon={Sparkles} label="Inserir embed (Figma, Maps, Loom…)" onClick={() => onInsert("embed")} />
      <Btn icon={MousePointerClick} label="Inserir botão" onClick={() => onInsert("button")} />
      <Btn icon={Minus} label="Inserir divisória" onClick={() => onInsert("divider")} />
      <Btn icon={Plus} label="Todos os blocos (⌘/)" onClick={onMoreBlocks} />

      <Sep />

      {/* Bloco selecionado */}
      <Btn icon={Settings2} label="Propriedades do bloco" disabled={!hasSelection} onClick={onProperties} />
      <Btn icon={Copy} label="Duplicar bloco (⌘D)" disabled={!hasSelection} onClick={onDuplicate} />
      <Btn icon={Trash2} label="Excluir bloco (⌘⇧⌫)" disabled={!hasSelection} onClick={onDelete} danger />

      <div className="ml-auto flex items-center gap-0.5 pl-2">
        <Btn icon={Keyboard} label="Atalhos do teclado (⌘⇧/)" onClick={onShortcuts} />
        <Btn icon={Eye} label="Visualizar como o leitor vê (⌘⇧P)" onClick={onTogglePreview} />
      </div>
    </div>
  );
}

function Sep() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-border" />;
}

function Btn({
  icon: Icon,
  label,
  onClick,
  disabled,
  danger,
  active,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      // Mantém a seleção do texto ao clicar na barra.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex size-8 shrink-0 items-center justify-center rounded-md transition-colors disabled:opacity-30 ${
        active
          ? "bg-primary text-primary-fg"
          : danger
            ? "text-text-muted hover:bg-surface-2 hover:text-brand-pink-700"
            : "text-text-muted hover:bg-surface-2 hover:text-text"
      }`}
    >
      <Icon className="size-4" />
    </button>
  );
}
