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
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-surface px-4 sm:px-5">
      <SearchTrigger />

      <div className="flex items-center gap-2 sm:gap-3">
        <ThemeToggle />
        <span className="hidden text-sm text-text-muted lg:inline">{email}</span>
        {/* Avatar em roxo, não em rosa: a marca principal é o roxo — o rosa é
            acento pontual, não identidade de pessoa. */}
        <div
          className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-fg"
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
