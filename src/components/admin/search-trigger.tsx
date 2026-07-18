"use client";

import { Search } from "lucide-react";

/** Botão da topbar que abre o command palette (Cmd/Ctrl+K). */
export function SearchTrigger() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("kb:open-search"))}
      className="flex h-9 w-full max-w-sm items-center gap-2 rounded-md border border-border bg-surface-2 px-3 text-sm text-text-muted transition hover:border-primary"
    >
      <Search className="size-4" />
      <span>Buscar…</span>
      <kbd className="ml-auto rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-xs">
        ⌘K
      </kbd>
    </button>
  );
}
