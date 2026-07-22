"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  Link2,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TreeNode } from "@/lib/content/tree";

const ICONS = {
  folder: Folder,
  article: FileText,
  link: Link2,
  divider: Minus,
} as const;

export function TreeItem({
  id,
  node,
  depth,
  collapsed,
  hasChildren,
  active,
  selected,
  checked,
  anyChecked,
  indentationWidth,
  onToggle,
  onSelect,
  onCheck,
  children: actions,
}: {
  id: string;
  node: TreeNode;
  depth: number;
  collapsed: boolean;
  hasChildren: boolean;
  active: boolean;
  selected: boolean;
  checked: boolean;
  /** Há itens marcados na árvore → mantém as caixas visíveis. */
  anyChecked: boolean;
  indentationWidth: number;
  onToggle: () => void;
  onSelect: (e: React.MouseEvent) => void;
  onCheck: (e: React.MouseEvent) => void;
  children?: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const Icon = ICONS[node.type];

  return (
    // Linha no padrão dos portais de referência (Microsoft Learn / Apple):
    // o título QUEBRA em várias linhas em vez de truncar, e as ações moram
    // num overlay que só existe no hover — antes elas ficavam no fluxo e
    // reservavam ~150px invisíveis em toda linha, o que cortava os títulos.
    <div
      ref={setNodeRef}
      data-node-id={id}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        paddingLeft: depth * indentationWidth + 4,
        opacity: isDragging ? 0.4 : 1,
      }}
      className={cn(
        "group relative flex items-start gap-1 rounded-md py-[3px] pr-1 text-[0.8125rem] leading-[1.45]",
        selected ? "bg-brand-purple-50 dark:bg-brand-purple-950/40" : "hover:bg-surface-2",
        checked && "bg-brand-purple-50 dark:bg-brand-purple-950/30",
        active && "ring-1 ring-ring",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={() => {}}
        onClick={(e) => onCheck(e)}
        aria-label="Selecionar"
        title="Selecionar (Shift para intervalo)"
        className={cn(
          "mt-[3px] size-3.5 shrink-0 accent-[var(--color-primary)]",
          checked || anyChecked ? "" : "opacity-0 group-hover:opacity-100",
        )}
      />

      {hasChildren ? (
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expandir" : "Colapsar"}
          title={collapsed ? "Expandir" : "Recolher"}
          className="mt-0.5 shrink-0 text-text-muted"
        >
          {collapsed ? (
            <ChevronRight className="size-3.5" />
          ) : (
            <ChevronDown className="size-3.5" />
          )}
        </button>
      ) : (
        <span className="w-3.5 shrink-0" />
      )}

      {/* O ícone do tipo É a alça de arrastar — o grip dedicado saiu, era
          mais uma coluna roubando espaço do título. */}
      <span
        aria-label="Arrastar para mover"
        title="Arrastar para mover"
        className="mt-0.5 shrink-0 cursor-grab touch-none text-text-muted active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <Icon className="size-4" />
      </span>

      <button
        type="button"
        onClick={onSelect}
        title="Clique para abrir · Shift+clique seleciona um intervalo · Ctrl/⌘+clique marca vários"
        className="min-w-0 flex-1 text-left [overflow-wrap:anywhere]"
      >
        {node.title}
        {node.status === "published" && (
          <span
            className="ml-1.5 inline-block size-1.5 rounded-full bg-primary align-middle"
            title="Publicado"
          />
        )}
      </button>

      {/* Mini-barra de ações: overlay com fundo próprio, aparece no hover ou
          quando algum botão dela recebe foco pelo teclado. */}
      <div className="pointer-events-none absolute right-0.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5 rounded-md border border-border bg-surface px-0.5 py-0.5 opacity-0 shadow-1 transition-opacity group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100"
      >
        {actions}
      </div>
    </div>
  );
}
