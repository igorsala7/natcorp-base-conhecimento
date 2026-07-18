"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Bot,
  CheckSquare,
  Code2,
  FolderTree,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Settings,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Painel", icon: LayoutDashboard, ready: true },
  { href: "/admin/conteudo", label: "Conteúdo", icon: FolderTree, ready: true },
  { href: "/admin/revisao", label: "Revisão", icon: CheckSquare, ready: true },
  { href: "/admin/lixeira", label: "Lixeira", icon: Trash2, ready: true },
  { href: "/admin/importar", label: "Importar", icon: Upload, ready: true },
  { href: "/admin/assistente", label: "Assistente", icon: Bot, ready: true },
  { href: "/admin/widget", label: "Widget e API", icon: Code2, ready: true },
  { href: "/admin/analises", label: "Análises", icon: BarChart3, ready: true },
  { href: "/admin/usuarios", label: "Usuários", icon: Users, ready: true },
  { href: "/admin/auditoria", label: "Auditoria", icon: ScrollText, ready: true },
  {
    href: "/admin/configuracoes",
    label: "Configurações",
    icon: Settings,
    ready: false,
  },
] as const;

const KEY = "kb.sidebarCollapsed";

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Restaura o estado (recolhido/expandido) do localStorage.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(localStorage.getItem(KEY) === "1");
  }, []);
  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 md:flex",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div
        className={cn(
          "flex h-14 items-center border-b border-border",
          collapsed ? "justify-center px-2" : "gap-2 px-5",
        )}
      >
        <div
          className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-fg text-sm font-bold"
          aria-hidden
        >
          N
        </div>
        {!collapsed && (
          <span className="flex-1 truncate text-sm font-semibold tracking-tight">
            Base de Conhecimento
          </span>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        {NAV.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          const base = cn(
            "flex items-center rounded-md py-2 text-sm font-medium transition-colors",
            collapsed ? "justify-center px-2" : "gap-3 px-3",
          );

          if (!item.ready) {
            return (
              <span
                key={item.href}
                className={cn(base, "cursor-not-allowed text-text-muted opacity-60")}
                title={collapsed ? `${item.label} — em fase futura` : "Disponível em fase futura"}
              >
                <Icon className="size-4 shrink-0" />
                {!collapsed && item.label}
              </span>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              title={collapsed ? item.label : undefined}
              className={cn(
                base,
                active
                  ? "bg-brand-purple-50 text-primary dark:bg-brand-purple-950/40"
                  : "text-text hover:bg-surface-2",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={toggle}
        title={collapsed ? "Expandir menu" : "Recolher menu"}
        className={cn(
          "flex items-center border-t border-border p-3 text-xs text-text-muted transition-colors hover:bg-surface-2 hover:text-text",
          collapsed ? "justify-center" : "gap-2",
        )}
      >
        {collapsed ? (
          <PanelLeftOpen className="size-4" />
        ) : (
          <>
            <PanelLeftClose className="size-4" /> Recolher
          </>
        )}
      </button>
    </aside>
  );
}
