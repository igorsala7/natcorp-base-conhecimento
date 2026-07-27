"use client";

import { createElement, useState } from "react";
import { Boxes, ChevronUp, Copy, Scissors, FolderInput, X } from "lucide-react";
import type { BlockType } from "@/lib/blocks/schema";
import { BLOCKS } from "@/lib/blocks/registry.meta";
import { GROUP_TARGETS } from "@/lib/blocks/group";

/**
 * Barra flutuante da SELEÇÃO. Com 1+ bloco selecionado: copiar/recortar (para
 * colar em qualquer artigo). Com 2+: também agrupar numa região (organizando os
 * filhos). Comum aos dois editores; `onCopy`/`onCut` são opcionais (o editor
 * embutido não os usa).
 */
export function GroupBar({
  count,
  onGroup,
  onCopy,
  onCut,
  onSendToArticle,
  onClear,
}: {
  count: number;
  onGroup: (type: BlockType) => void;
  onCopy?: () => void;
  onCut?: () => void;
  /** Abre o diálogo "copiar/mover para um artigo". */
  onSendToArticle?: () => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {open && <div className="fixed inset-0 z-40" aria-hidden onClick={() => setOpen(false)} />}
      <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-surface px-2 py-1.5 shadow-2">
        <span className="flex items-center gap-1.5 pl-2 pr-1 text-sm font-medium">
          <Boxes className="size-4 text-primary" />
          {count} {count === 1 ? "selecionado" : "selecionados"}
        </span>

        {(onCopy || onCut || onSendToArticle) && (
          <div className="flex items-center gap-1">
            {onCopy && (
              <button
                type="button"
                onClick={onCopy}
                title="Copiar (cola em qualquer artigo)"
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-medium text-text transition-colors hover:bg-surface-2"
              >
                <Copy className="size-4" /> Copiar
              </button>
            )}
            {onCut && (
              <button
                type="button"
                onClick={onCut}
                title="Recortar (remove daqui e cola em qualquer artigo)"
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-medium text-text transition-colors hover:bg-surface-2"
              >
                <Scissors className="size-4" /> Recortar
              </button>
            )}
            {onSendToArticle && (
              <button
                type="button"
                onClick={onSendToArticle}
                title="Copiar ou mover para outro artigo"
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-medium text-text transition-colors hover:bg-surface-2"
              >
                <FolderInput className="size-4" /> Para artigo…
              </button>
            )}
          </div>
        )}

        {count >= 2 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg shadow-1 transition-colors hover:bg-primary-hover"
          >
            Agrupar em
            <ChevronUp className={`size-4 transition-transform ${open ? "" : "rotate-180"}`} />
          </button>

          {open && (
            <div className="absolute bottom-full left-1/2 mb-2 max-h-72 w-56 -translate-x-1/2 overflow-auto rounded-lg border border-border bg-surface p-1 shadow-2">
              {GROUP_TARGETS.map((t) => {
                const Meta = BLOCKS[t];
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      onGroup(t);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-surface-2"
                  >
                    {createElement(Meta.icon, { className: "size-4 text-text-muted" })}
                    {Meta.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        )}

        <button
          type="button"
          onClick={onClear}
          title="Limpar seleção (Esc)"
          className="flex size-7 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
        >
          <X className="size-4" />
        </button>
      </div>
    </>
  );
}
