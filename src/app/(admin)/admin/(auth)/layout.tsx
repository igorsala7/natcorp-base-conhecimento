import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Layout das telas de autenticação (login, definir senha, MFA).
 * Sem sidebar: o usuário ainda não tem sessão completa. Card centrado,
 * tipografia calma, marca discreta.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg text-text">
      <header className="flex h-14 items-center justify-between px-5">
        <div className="flex items-center gap-2">
          <div
            className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-fg text-sm font-bold"
            aria-hidden
          >
            N
          </div>
          <span className="text-sm font-semibold tracking-tight">
            Base de Conhecimento
          </span>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm">{children}</div>
      </main>

      <footer className="p-5 text-center text-xs text-text-muted">
        Natcorp · Acesso restrito à equipe
      </footer>
    </div>
  );
}
