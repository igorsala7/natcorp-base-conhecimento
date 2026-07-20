"use client";

import { useEffect, useRef, useState } from "react";
import { MoreVertical, Copy, Trash2, ArrowUp, ArrowDown, Shuffle } from "lucide-react";
import type { Block } from "@/lib/blocks/schema";
import { BLOCKS } from "@/lib/blocks/registry.meta";
import type { EditorActions } from "./edit-types";

export function BlockMenu({ block, actions }: { block: Block; actions: EditorActions }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const transforms = BLOCKS[block.type].transformableTo;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Ações do bloco"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex size-6 items-center justify-center rounded text-text-muted hover:bg-surface-2"
      >
        <MoreVertical className="size-4" />
      </button>
      {open && (
        <div
          className="absolute left-0 top-7 z-40 w-52 rounded-lg border border-border bg-surface p-1.5 shadow-2"
          onClick={(e) => e.stopPropagation()}
        >
          {transforms.length > 0 && (
            <>
              <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-text-muted">
                <Shuffle className="mr-1 inline size-3" /> Transformar em
              </p>
              <div className="mb-1 flex flex-wrap gap-1 px-1">
                {transforms.map((t) => {
                  const meta = BLOCKS[t];
                  const Icon = meta.icon;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        actions.transform(block.id, t);
                        setOpen(false);
                      }}
                      className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:border-primary hover:text-primary"
                    >
                      <Icon className="size-3" /> {meta.label}
                    </button>
                  );
                })}
              </div>
              <div className="my-1 h-px bg-border" />
            </>
          )}
          <MenuItem icon={ArrowUp} label="Mover para cima" onClick={() => { actions.move(block.id, -1); setOpen(false); }} />
          <MenuItem icon={ArrowDown} label="Mover para baixo" onClick={() => { actions.move(block.id, 1); setOpen(false); }} />
          <MenuItem icon={Copy} label="Duplicar" onClick={() => { actions.duplicate(block.id); setOpen(false); }} />
          <MenuItem icon={Trash2} label="Excluir" danger onClick={() => { actions.remove(block.id); setOpen(false); }} />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: typeof Copy;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-2 ${
        danger ? "text-brand-pink-700" : ""
      }`}
    >
      <Icon className="size-4" /> {label}
    </button>
  );
}
