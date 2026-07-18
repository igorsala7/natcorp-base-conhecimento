import { ThemeToggle } from "@/components/theme-toggle";
import { signOut } from "@/app/(admin)/admin/(auth)/actions";
import { Button } from "@/components/ui/button";
import { SearchTrigger } from "@/components/admin/search-trigger";

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
      <SearchTrigger />

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
