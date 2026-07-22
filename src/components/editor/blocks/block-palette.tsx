"use client";

import { useDraggable } from "@dnd-kit/core";
import { Plus, Repeat2 } from "lucide-react";
import type { BlockType } from "@/lib/blocks/schema";
import { CATEGORIES, COMING_SOON, slashBlocks, type BlockMeta } from "@/lib/blocks/registry.meta";

/**
 * Paleta lateral do editor (padrão Lumina): blocos agrupados, ARRASTÁVEIS
 * para o canvas e clicáveis (adiciona ao fim, já selecionado). Convive com o
 * slash menu — a paleta é descoberta visual; o "/" é velocidade no teclado.
 */
export function BlockPalette({
  onAdd,
  snippets,
  onAddSnippet,
}: {
  onAdd: (type: BlockType) => void;
  snippets: { key: string; title: string }[];
  onAddSnippet: (key: string) => void;
}) {
  const porCategoria = CATEGORIES.map((cat) => ({
    cat,
    items: slashBlocks().filter((m) => m.category === cat.key),
  }));

  return (
    <div className="space-y-4">
      <p className="rounded-md border border-brand-purple-100 bg-brand-purple-50/60 px-3 py-2.5 text-[11px] leading-[1.6] text-brand-purple-800 dark:border-brand-purple-900 dark:bg-brand-purple-950/40 dark:text-brand-purple-200">
        <strong>Arraste</strong> um bloco para o artigo ou <strong>clique</strong> para
        adicioná-lo ao final.
      </p>
      {porCategoria.map(({ cat, items }) => {
        if (cat.comingSoon) {
          return (
            <div key={cat.key}>
              <GroupLabel>{cat.label}</GroupLabel>
              <div className="space-y-0.5">
                {COMING_SOON.map((c) => (
                  <div
                    key={c.label}
                    className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 opacity-60"
                  >
                    <IconBox>
                      <c.icon className="size-4" />
                    </IconBox>
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-text-muted">
                      {c.label}
                    </span>
                    <span className="shrink-0 rounded-full bg-surface-2 px-1.5 py-0.5 text-[0.625rem] font-semibold text-text-muted">
                      Em breve
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        }
        if (!items.length) return null;
        return (
          <div key={cat.key}>
            <GroupLabel>{cat.label}</GroupLabel>
            <div className="space-y-0.5">
              {items.map((meta) => (
                <PaletteItem key={meta.type} meta={meta} onAdd={onAdd} />
              ))}
            </div>
          </div>
        );
      })}
      {snippets.length > 0 && (
        <div>
          <GroupLabel>Snippets</GroupLabel>
          <div className="space-y-0.5">
            {snippets.map((sn) => (
              <button
                key={sn.key}
                type="button"
                onClick={() => onAddSnippet(sn.key)}
                title="Inserir snippet reutilizável ao final"
                className="group flex w-full items-center gap-2.5 rounded-md border border-transparent px-2.5 py-2 text-left transition-colors hover:border-brand-purple-200 hover:bg-brand-purple-50/70 dark:hover:border-brand-purple-900 dark:hover:bg-brand-purple-950/40"
              >
                <IconBox>
                  <Repeat2 className="size-4" />
                </IconBox>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold">{sn.title}</span>
                  <span className="block truncate text-[10px] text-brand-gray-400">
                    {sn.key}
                  </span>
                </span>
                <Plus className="ml-auto size-3.5 shrink-0 text-text-muted opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 px-1 text-[0.625rem] font-bold uppercase tracking-widest text-text-muted">
      {children}
    </p>
  );
}

function IconBox({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-sm border border-border bg-surface text-text-muted shadow-1 transition-colors group-hover:border-brand-purple-300 group-hover:text-primary">
      {children}
    </span>
  );
}

function PaletteItem({ meta, onAdd }: { meta: BlockMeta; onAdd: (t: BlockType) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${meta.type}`,
    data: { fromPalette: true, blockType: meta.type },
  });
  const Icon = meta.icon;
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      onClick={() => onAdd(meta.type)}
      title={`${meta.label} — arraste para o artigo ou clique para adicionar ao final`}
      className={`group flex w-full cursor-grab items-center gap-2.5 rounded-md border border-transparent px-2.5 py-2 text-left transition-colors hover:border-brand-purple-200 hover:bg-brand-purple-50/70 active:cursor-grabbing dark:hover:border-brand-purple-900 dark:hover:bg-brand-purple-950/40 ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <IconBox>
        <Icon className="size-4" />
      </IconBox>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold">{meta.label}</span>
        {meta.description && (
          <span className="block truncate text-[10px] text-brand-gray-400">
            {meta.description}
          </span>
        )}
      </span>
      <Plus className="ml-auto size-3.5 shrink-0 text-text-muted opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}
