"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  GripVertical,
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
  indentationWidth,
  onToggle,
  onSelect,
  children: actions,
}: {
  id: string;
  node: TreeNode;
  depth: number;
  collapsed: boolean;
  hasChildren: boolean;
  active: boolean;
  selected: boolean;
  indentationWidth: number;
  onToggle: () => void;
  onSelect: () => void;
  children?: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const Icon = ICONS[node.type];

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        paddingLeft: depth * indentationWidth + 8,
        opacity: isDragging ? 0.4 : 1,
      }}
      className={cn(
        "group flex items-center gap-1 rounded-md py-1 pr-2 text-sm",
        selected ? "bg-brand-purple-50 dark:bg-brand-purple-950/40" : "hover:bg-surface-2",
        active && "ring-1 ring-ring",
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-text-muted opacity-0 group-hover:opacity-100"
        aria-label="Arrastar"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>

      {hasChildren ? (
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expandir" : "Colapsar"}
          className="text-text-muted"
        >
          {collapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <ChevronDown className="size-4" />
          )}
        </button>
      ) : (
        <span className="w-4" />
      )}

      <button
        type="button"
        onClick={onSelect}
        className="flex flex-1 items-center gap-2 truncate text-left"
      >
        <Icon className="size-4 shrink-0 text-text-muted" />
        <span className="truncate">{node.title}</span>
        {node.status === "published" && (
          <span className="ml-1 size-1.5 shrink-0 rounded-full bg-primary" title="Publicado" />
        )}
      </button>

      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
        {actions}
      </div>
    </div>
  );
}
