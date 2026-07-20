"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  CornerDownLeft,
  Plus,
  Settings2,
  Shuffle,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import type { Block, BlockType } from "@/lib/blocks/schema";
import { BLOCKS } from "@/lib/blocks/registry.meta";
import type { EditorActions } from "./edit-types";

/** Ação "adicionar filho" específica de cada contêiner. */
const ADD_CHILD: Partial<Record<BlockType, { label: string; child: BlockType }>> = {
  container: { label: "Adicionar coluna", child: "column" },
  cardGrid: { label: "Adicionar card", child: "card" },
  steps: { label: "Adicionar passo", child: "step" },
  bulletList: { label: "Adicionar item", child: "listItem" },
  orderedList: { label: "Adicionar item", child: "listItem" },
  accordion: { label: "Adicionar seção", child: "accordionItem" },
  tabs: { label: "Adicionar aba", child: "tab" },
};

export function BlockContextMenu({
  block,
  x,
  y,
  actions,
  onClose,
  onProperties,
}: {
  block: Block;
  x: number;
  y: number;
  actions: EditorActions;
  onClose: () => void;
  onProperties: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const meta = BLOCKS[block.type];
  const transforms = meta.transformableTo;
  const addChild = ADD_CHILD[block.type];
  const childCount = "children" in block ? (block.children?.length ?? 0) : 0;

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [onClose]);

  // Mantém o menu dentro da viewport.
  const left = Math.min(x, window.innerWidth - 240);
  const top = Math.min(y, window.innerHeight - 360);

  const run = (fn: () => void) => () => {
    fn();
    onClose();
  };

  return (
    <div
      ref={ref}
      role="menu"
      style={{ left, top }}
      className="fixed z-50 w-56 rounded-lg border border-border bg-surface p-1.5 shadow-2"
      onContextMenu={(e) => e.preventDefault()}
    >
      <p className="px-2 pb-1 pt-0.5 text-[11px] font-medium uppercase tracking-wide text-text-muted">
        {meta.label}
      </p>

      <Item icon={Plus} label="Inserir bloco abaixo" hint="⌘↵" onClick={run(() => actions.insertAfter(block.id, "paragraph"))} />
      {addChild && (
        <Item
          icon={CornerDownLeft}
          label={addChild.label}
          onClick={run(() => {
            actions.addChild(block.id, addChild.child);
            if (block.type === "container") {
              actions.patch(block.id, { data: { columns: Math.min(5, childCount + 1) } } as Partial<Block>);
            }
          })}
        />
      )}

      {transforms.length > 0 && (
        <>
          <Divider />
          <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-text-muted">
            <Shuffle className="mr-1 inline size-3" /> Transformar em
          </p>
          <div className="mb-1 flex flex-wrap gap-1 px-1">
            {transforms.map((t) => {
              const m = BLOCKS[t];
              const Icon = m.icon;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={run(() => actions.transform(block.id, t))}
                  className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:border-primary hover:text-primary"
                >
                  <Icon className="size-3" /> {m.label}
                </button>
              );
            })}
          </div>
        </>
      )}

      <Divider />
      <Item icon={ArrowUp} label="Mover para cima" hint="⌥⇧↑" onClick={run(() => actions.move(block.id, -1))} />
      <Item icon={ArrowDown} label="Mover para baixo" hint="⌥⇧↓" onClick={run(() => actions.move(block.id, 1))} />
      <Item icon={Copy} label="Duplicar" hint="⌘D" onClick={run(() => actions.duplicate(block.id))} />
      <Item icon={Settings2} label="Propriedades" onClick={run(onProperties)} />
      <Divider />
      <Item icon={Trash2} label="Excluir" hint="⌘⇧⌫" danger onClick={run(() => actions.remove(block.id))} />
    </div>
  );
}

function Divider() {
  return <div className="my-1 h-px bg-border" />;
}

function Item({
  icon: Icon,
  label,
  hint,
  onClick,
  danger,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  onClick: () => void;
  danger?: boolean;
}): ReactNode {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-2 ${
        danger ? "text-brand-pink-700" : ""
      }`}
    >
      <Icon className="size-4 shrink-0" />
      <span className="flex-1">{label}</span>
      {hint && <span className="text-[11px] tabular-nums text-text-muted">{hint}</span>}
    </button>
  );
}
