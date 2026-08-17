import { ThemeToggle } from "@/components/theme-toggle";
import { signOut } from "@/app/(admin)/admin/(auth)/actions";
import { Button } from "@/components/ui/button";
import { SearchTrigger } from "@/components/admin/search-trigger";
import { Atividade } from "@/components/admin/atividade";
import { Breadcrumb } from "@/components/admin/breadcrumb";
import { BotaoMenuMobile } from "@/components/admin/sidebar";

/**
 * Barra superior do Admin: trilha de navegação, busca e conta.
 *
 * O `SearchTrigger` abre o command palette (Cmd/Ctrl+K) — este comentário
 * dizia, até aqui, que ele era "um placeholder visual" e que a paleta "chega na
 * Fase 3". Ela chegou há muito tempo. Comentário obsoleto em arquivo central é
 * armadilha: alguém lê, acredita, e reimplementa o que já existe.
 */
export function Topbar({ email }: { email: string }) {
  const initials =
    email
      .split("@")[0]
      ?.slice(0, 2)
      .toUpperCase() || "NA";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-surface px-4 sm:px-5">
      {/* `min-w-0` nos dois: sem ele, um rótulo longo empurra a busca para fora
          da barra em vez de truncar. */}
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
        {/* Primeiro elemento da barra, no FLUXO. Era um `fixed left-3 top-3`
            que flutuava por cima do breadcrumb em toda tela do celular. */}
        <BotaoMenuMobile />
        <Breadcrumb />
        <SearchTrigger />
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <Atividade />
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
