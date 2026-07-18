import { Search } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { signOut } from "@/app/(admin)/admin/(auth)/actions";
import { Button } from "@/components/ui/button";

/**
 * Barra superior do Admin. O campo de busca é um placeholder visual —
 * o command palette (Cmd/Ctrl+K) real chega na Fase 3.
 */
export function Topbar({ email }: { email: string }) {
  const initials =
    email
      .split("@")[0]
      ?.slice(0, 2)
      .toUpperCase() || "NA";

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

      <div className="flex items-center gap-3">
        <ThemeToggle />
        <span className="hidden text-sm text-text-muted sm:inline">
          {email}
        </span>
        <div
          className="flex size-8 items-center justify-center rounded-full bg-accent text-accent-fg text-xs font-semibold"
          aria-hidden
        >
          {initials}
        </div>
        <form action={signOut}>
          <Button variant="ghost" size="sm" type="submit">
            Sair
          </Button>
        </form>
      </div>
    </header>
  );
}
