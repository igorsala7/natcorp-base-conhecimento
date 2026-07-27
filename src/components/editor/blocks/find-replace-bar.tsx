"use client";

import { ChevronDown, ChevronUp, Replace, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Barra de Localizar e Substituir (Ctrl+F) do editor. Flutua no canto superior
 * direito. A lógica (achar/substituir/navegar) mora no shell; aqui é só a UI.
 */
export function FindReplaceBar({
  query,
  onQuery,
  replaceValue,
  onReplaceValue,
  caseSensitive,
  onToggleCase,
  count,
  current,
  onPrev,
  onNext,
  onReplace,
  onReplaceAll,
  onClose,
}: {
  query: string;
  onQuery: (v: string) => void;
  replaceValue: string;
  onReplaceValue: (v: string) => void;
  caseSensitive: boolean;
  onToggleCase: () => void;
  count: number;
  /** 1-based; 0 quando nada está focado ainda. */
  current: number;
  onPrev: () => void;
  onNext: () => void;
  onReplace: () => void;
  onReplaceAll: () => void;
  onClose: () => void;
}) {
  const iconBtn =
    "flex size-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:opacity-40";
  return (
    <div
      className="fixed right-6 top-20 z-40 w-[22rem] rounded-lg border border-border bg-surface p-2 shadow-2"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="flex items-center gap-1">
        <div className="relative flex-1">
          <Input
            autoFocus
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Localizar"
            className="h-8 pr-16 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (e.shiftKey) onPrev();
                else onNext();
              }
            }}
          />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] tabular-nums text-text-muted">
            {count ? `${current || "•"}/${count}` : "0"}
          </span>
        </div>
        <button type="button" className={iconBtn} onClick={onPrev} disabled={!count} title="Anterior (Shift+Enter)">
          <ChevronUp className="size-4" />
        </button>
        <button type="button" className={iconBtn} onClick={onNext} disabled={!count} title="Próximo (Enter)">
          <ChevronDown className="size-4" />
        </button>
        <button
          type="button"
          className={`${iconBtn} text-xs font-semibold ${caseSensitive ? "bg-brand-purple-50 text-primary dark:bg-brand-purple-950/40" : ""}`}
          onClick={onToggleCase}
          aria-pressed={caseSensitive}
          title="Diferenciar maiúsculas/minúsculas"
        >
          Aa
        </button>
        <button type="button" className={iconBtn} onClick={onClose} title="Fechar (Esc)">
          <X className="size-4" />
        </button>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <Input
          value={replaceValue}
          onChange={(e) => onReplaceValue(e.target.value)}
          placeholder="Substituir por"
          className="h-8 flex-1 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onReplace();
            }
          }}
        />
        <Button size="sm" variant="secondary" onClick={onReplace} disabled={!count} title="Substituir a ocorrência atual">
          Substituir
        </Button>
        <Button size="sm" variant="secondary" onClick={onReplaceAll} disabled={!query} title="Substituir todas">
          <Replace className="size-4" /> Tudo
        </Button>
      </div>
    </div>
  );
}
