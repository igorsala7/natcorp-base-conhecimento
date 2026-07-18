"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FolderTree,
  LayoutDashboard,
  ScrollText,
  Search,
  Settings,
  Upload,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Navegação do Admin. Os itens além do Painel apontam para rotas que ainda
 * não existem (chegam nas próximas fases) — marcados como desabilitados para
 * deixar a estrutura visível sem prometer o que ainda não há.
 */
const NAV = [
  { href: "/admin", label: "Painel", icon: LayoutDashboard, ready: true },
  { href: "/admin/conteudo", label: "Conteúdo", icon: FolderTree, ready: true },
  { href: "/admin/importar", label: "Importar", icon: Upload, ready: true },
  { href: "/admin/busca", label: "Busca", icon: Search, ready: false },
  { href: "/admin/usuarios", label: "Usuários", icon: Users, ready: true },
  { href: "/admin/auditoria", label: "Auditoria", icon: ScrollText, ready: true },
  {
    href: "/admin/configuracoes",
    label: "Configurações",
    icon: Settings,
    ready: false,
  },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
      <div className="flex h-14 items-center gap-2 border-b border-border px-5">
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

      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        {NAV.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          if (!item.ready) {
            return (
              <span
                key={item.href}
                className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm text-text-muted opacity-60"
                title="Disponível em fase futura"
              >
                <Icon className="size-4" />
                {item.label}
              </span>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-brand-purple-50 text-primary dark:bg-brand-purple-950/40"
                  : "text-text hover:bg-surface-2",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3 text-xs text-text-muted">
        Fase 0 · Fundação
      </div>
    </aside>
  );
}
