"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  Bot,
  CheckSquare,
  Code2,
  LayoutDashboard,
  Library,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  SlidersHorizontal,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Agrupado pelo OBJETO da ação, não pela ferramenta. As áreas de UMA
 * documentação (conteúdo, aparência, preferências, chatbot, prévia) NÃO têm
 * item próprio: a porta de entrada é "Documentações", que lista cada uma com
 * seus atalhos — dois caminhos no menu para o mesmo destino só disputariam
 * atenção. `also` mantém o item aceso ao navegar para dentro dessas áreas.
 */
const GRUPOS = [
  {
    label: null, // Soltos no topo: o retorno (Painel) e a porta de entrada.
    items: [
      { href: "/admin", label: "Painel", icon: LayoutDashboard, ready: true },
      {
        href: "/admin/documentacoes",
        label: "Documentações",
        icon: Library,
        ready: true,
        also: [
          "/admin/conteudo",
          "/admin/aparencia",
          "/admin/configuracoes",
          "/admin/base-conhecimento",
          "/admin/previa",
        ],
      },
    ],
  },
  {
    label: "Fluxo de conteúdo",
    items: [
      { href: "/admin/importar", label: "Importar", icon: Upload, ready: true },
      { href: "/admin/revisao", label: "Revisão", icon: CheckSquare, ready: true },
      { href: "/admin/lixeira", label: "Lixeira", icon: Trash2, ready: true },
    ],
  },
  {
    label: "Canais e análises",
    items: [
      { href: "/admin/assistente", label: "Assistente", icon: Bot, ready: true },
      { href: "/admin/widget", label: "Widget e API", icon: Code2, ready: true },
      { href: "/admin/analises", label: "Análises", icon: BarChart3, ready: true },
    ],
  },
  {
    label: "Administração",
    items: [
      { href: "/admin/usuarios", label: "Usuários", icon: Users, ready: true },
      { href: "/admin/auditoria", label: "Auditoria", icon: ScrollText, ready: true },
      { href: "/admin/sistema", label: "Sistema", icon: SlidersHorizontal, ready: true },
    ],
  },
] as const;

/** `"1"` = fixada aberta. O padrão (ausente ou `"0"`) é recolhida. */
const KEY = "kb.sidebarPinned";
/** Carência antes de recolher: dá tempo de sair e voltar sem a barra sumir. */
const ATRASO_RECOLHER = 1000;

export function Sidebar() {
  const pathname = usePathname();
  // Fixada pelo usuário no botão — sobrevive à navegação.
  const [pinned, setPinned] = useState(false);
  // Aberta temporariamente pelo mouse/teclado — não persiste.
  const [espiando, setEspiando] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPinned(localStorage.getItem(KEY) === "1");
  }, []);

  // Não deixa um timer pendente disparar depois da desmontagem.
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  function abrir() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setEspiando(true);
  }

  function agendarFechar() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      setEspiando(false);
    }, ATRASO_RECOLHER);
  }

  function toggle() {
    setPinned((p) => {
      const next = !p;
      localStorage.setItem(KEY, next ? "1" : "0");
      return next;
    });
    setEspiando(false);
  }

  const expandida = pinned || espiando;
  const collapsed = !expandida;

  return (
    // Duas camadas de propósito: este espaçador segura o lugar na largura
    // RECOLHIDA e a barra flutua por cima ao espiar. Se ela empurrasse o
    // conteúdo, a página inteira refluiria a cada passada do mouse.
    <div className={cn("relative hidden shrink-0 md:block", pinned ? "w-60" : "w-16")}>
      <aside
        onMouseEnter={abrir}
        onMouseLeave={agendarFechar}
        // Teclado também abre: navegação por Tab não gera hover, e sem isto a
        // barra ficaria inalcançável para quem não usa mouse.
        onFocusCapture={abrir}
        onBlurCapture={agendarFechar}
        className={cn(
          "absolute inset-y-0 left-0 z-30 flex flex-col border-r border-border bg-surface",
          "transition-[width] duration-base ease-out motion-reduce:transition-none",
          expandida ? "w-60" : "w-16",
          // Só sombra quando flutua sobre o conteúdo; fixada, ela faz parte do
          // layout e sombra ali seria ruído.
          !pinned && espiando && "shadow-2",
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

        <nav className="flex flex-1 flex-col overflow-y-auto p-2.5">
          {GRUPOS.map((grupo, gi) => (
            <div key={grupo.label ?? "raiz"} className={gi > 0 ? "mt-5" : undefined}>
              {grupo.label &&
                (collapsed ? (
                  // Recolhida não há espaço para o rótulo: o grupo vira um traço.
                  <div className="mx-2 mb-2 border-t border-border" aria-hidden="true" />
                ) : (
                  <p className="mb-1 px-3 text-[0.6875rem] font-semibold uppercase tracking-wider text-text-muted">
                    {grupo.label}
                  </p>
                ))}
              <div className="flex flex-col gap-0.5">
                {grupo.items.map((item) => {
                  // `also`: rotas-filhas acessadas de dentro de "Documentações"
                  // (conteúdo, aparência…) mantêm o item de origem aceso — sem
                  // isto, navegar pelo hub apagaria o menu inteiro.
                  const emAlso =
                    "also" in item && item.also.some((p) => pathname.startsWith(p));
                  const active =
                    item.href === "/admin"
                      ? pathname === "/admin"
                      : pathname.startsWith(item.href) || emAlso;
                  const Icon = item.icon;
                  const base = cn(
                    "relative flex items-center rounded-md py-2 text-sm transition-colors",
                    collapsed ? "justify-center px-2" : "gap-3 px-3",
                  );

                  if (!item.ready) {
                    return (
                      <span
                        key={item.href}
                        className={cn(base, "cursor-not-allowed text-text-muted opacity-60")}
                        title={
                          collapsed ? `${item.label} — em fase futura` : "Disponível em fase futura"
                        }
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
                          ? "bg-brand-purple-50 font-semibold text-primary dark:bg-brand-purple-950/40"
                          : "font-medium text-text hover:bg-surface-2",
                      )}
                    >
                      {/* Barra + peso além do fundo: o estado ativo não pode
                          depender só da cor. */}
                      {active && (
                        <span
                          aria-hidden="true"
                          className="absolute inset-y-1.5 left-0 w-0.5 rounded-r-full bg-primary"
                        />
                      )}
                      <Icon className="size-4 shrink-0" />
                      {!collapsed && item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* O botão agora FIXA, não "expande": expandir já é o hover. Sem ele,
            quem usa o menu o tempo todo ficaria refém da barra sumindo. */}
        <button
          type="button"
          onClick={toggle}
          aria-pressed={pinned}
          title={pinned ? "Desafixar menu (recolhe sozinho)" : "Fixar menu aberto"}
          className={cn(
            "flex items-center border-t border-border p-3 text-xs text-text-muted transition-colors hover:bg-surface-2 hover:text-text",
            collapsed ? "justify-center" : "gap-2",
          )}
        >
          {pinned ? (
            <>
              <PanelLeftClose className="size-4" /> Desafixar
            </>
          ) : collapsed ? (
            <PanelLeftOpen className="size-4" />
          ) : (
            <>
              <PanelLeftOpen className="size-4" /> Fixar aberto
            </>
          )}
        </button>
      </aside>
    </div>
  );
}
