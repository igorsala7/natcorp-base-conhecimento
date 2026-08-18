"use client";

import { Check, Plus, Trash2 } from "lucide-react";
import { newId, type Block, type RichText as RT } from "@/lib/blocks/schema";
import { RichText } from "../rich-text/rich-text";
import { addItemClass } from "@/components/ui/segmented";
import type { BlockEditProps } from "../edit-types";

/**
 * Checklist: itens com texto RICO (mesmo padrão das células da tabela) e o
 * visual WYSIWYG do portal — o checkbox do editor É o quadrado publicado.
 */
export function ChecklistBlock({ block, onChange }: BlockEditProps) {
  const b = block as Extract<Block, { type: "checklist" }>;
  const items = b.data.items;

  const set = (next: typeof items) =>
    onChange({ data: { items: next } } as Partial<Block>);

  return (
    <div className="my-2 space-y-2">
      {items.map((item) => (
        <div key={item.id} className="group/item flex items-start gap-2.5 text-sm">
          <button
            type="button"
            aria-label={item.checked ? "Desmarcar" : "Marcar"}
            onClick={() =>
              set(items.map((i) => (i.id === item.id ? { ...i, checked: !i.checked } : i)))
            }
            className={`mt-0.5 flex size-[1.125rem] shrink-0 items-center justify-center rounded-sm border transition-colors ${
              item.checked
                ? "border-primary bg-primary text-primary-fg"
                : "border-border-strong bg-surface hover:border-primary"
            }`}
          >
            {item.checked && <Check className="size-3.5" />}
          </button>
          <div className={`min-w-0 flex-1 ${item.checked ? "text-text-muted line-through" : ""}`}>
            <RichText
              value={item.text}
              onChange={(t: RT) =>
                set(items.map((i) => (i.id === item.id ? { ...i, text: t } : i)))
              }
              placeholder="Item da lista…"
            />
          </div>
          <button
            type="button"
            title="Remover item"
            onClick={() => set(items.filter((i) => i.id !== item.id))}
            className="mt-0.5 rounded p-1 text-text-muted opacity-0 transition-opacity hover:bg-danger-soft hover:text-danger group-hover/item:opacity-100"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        className={addItemClass}
        onClick={() => set([...items, { id: newId(), text: [], checked: false }])}
      >
        <Plus className="size-3.5" /> Adicionar item
      </button>
    </div>
  );
}

/** Indicadores/KPIs: prévia WYSIWYG + grade de inputs por cartão. */
export function StatsBlock({ block, onChange }: BlockEditProps) {
  const b = block as Extract<Block, { type: "stats" }>;
  const items = b.data.items;
  const set = (next: typeof items) =>
    onChange({ data: { items: next } } as Partial<Block>);
  const patch = (id: string, campo: "value" | "label" | "trend", v: string) =>
    set(items.map((i) => (i.id === id ? { ...i, [campo]: v } : i)));

  const inputCls =
    "w-full bg-transparent focus:outline-none placeholder:text-text-muted/60";

  return (
    <div className="my-2">
      <div className="grid gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="group/item relative rounded-lg border border-border bg-gradient-to-b from-surface to-surface-2/60 p-4 shadow-1"
          >
            <input
              value={item.value}
              onChange={(e) => patch(item.id, "value", e.target.value)}
              placeholder="98%"
              className={`${inputCls} text-2xl font-bold tracking-tight text-primary`}
            />
            <input
              value={item.label}
              onChange={(e) => patch(item.id, "label", e.target.value)}
              placeholder="Rótulo"
              className={`${inputCls} mt-1 text-sm font-semibold`}
            />
            <input
              value={item.trend}
              onChange={(e) => patch(item.id, "trend", e.target.value)}
              placeholder="Detalhe do indicador"
              className={`${inputCls} mt-0.5 text-xs text-text-muted`}
            />
            <button
              type="button"
              title="Remover indicador"
              onClick={() => set(items.filter((i) => i.id !== item.id))}
              className="absolute right-2 top-2 rounded p-1 text-text-muted opacity-0 transition-opacity hover:bg-danger-soft hover:text-danger group-hover/item:opacity-100"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className={`${addItemClass} mt-3`}
        onClick={() =>
          set([...items, { id: newId(), value: "", label: "", trend: "" }])
        }
      >
        <Plus className="size-3.5" /> Adicionar indicador
      </button>
    </div>
  );
}
