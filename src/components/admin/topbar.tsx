import { Search } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Barra superior do Admin. O campo de busca é um placeholder visual —
 * o command palette (Cmd/Ctrl+K) real chega na Fase 3.
 */
export function Topbar() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-surface px-5">
      <button
        type="button"
        disabled
        className="flex h-9 w-full max-w-sm cursor-not-allowed items-center gap-2 rounded-md border border-border bg-surface-2 px-3 text-sm text-text-muted"
      >
        <Search className="size-4" />
        <span>Buscar…</span>
        <kbd className="ml-auto rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-xs">
          ⌘K
        </kbd>
      </button>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <div
          className="flex size-8 items-center justify-center rounded-full bg-accent text-accent-fg text-xs font-semibold"
          aria-hidden
        >
          NA
        </div>
      </div>
    </header>
  );
}
