"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PortalTreeNode } from "@/lib/portal/data";
import { useActiveArticle } from "./active-article";

/** Navegação lateral do portal: árvore colapsável de seções e artigos. */
export function PortalNav({
  spaceSlug,
  tree,
  activePath,
  onNavigate,
}: {
  spaceSlug: string;
  tree: PortalTreeNode[];
  activePath: string;
  onNavigate?: () => void;
}) {
  // Abre por padrão as pastas que contêm a página ativa.
  const [open, setOpen] = useState<Set<string>>(() => {
    const set = new Set<string>();
    const mark = (nodes: PortalTreeNode[]) => {
      for (const n of nodes) {
        const p = n.slugPath.join("/");
        if (n.children.length && (activePath === p || activePath.startsWith(p + "/"))) {
          set.add(n.id);
        }
        mark(n.children);
      }
    };
    mark(tree);
    return set;
  });

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Leitura contínua: o artigo visível no scroll manda no destaque.
  const reading = useActiveArticle();
  const activeId = reading?.activeId ?? null;

  // Abre as pastas que contêm o artigo em leitura — senão o destaque fica
  // escondido dentro de uma pasta recolhida enquanto se rola a página.
  useEffect(() => {
    if (!activeId) return;
    const caminho: string[] = [];
    const acha = (nodes: PortalTreeNode[], trilha: string[]): boolean => {
      for (const n of nodes) {
        if (n.id === activeId) {
          caminho.push(...trilha);
          return true;
        }
        if (acha(n.children, [...trilha, n.id])) return true;
      }
      return false;
    };
    acha(tree, []);
    if (caminho.length === 0) return;
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setOpen((prev) => {
      if (caminho.every((id) => prev.has(id))) return prev;
      const next = new Set(prev);
      caminho.forEach((id) => next.add(id));
      return next;
    });
  }, [activeId, tree]);

  return (
    <nav aria-label="Navegação da documentação" className="text-[0.84375rem]">
      <NavList
        spaceSlug={spaceSlug}
        nodes={tree}
        activePath={activePath}
        depth={0}
        open={open}
        toggle={toggle}
        onNavigate={onNavigate}
        activeId={activeId}
        onPage={reading?.onPage ?? EMPTY}
      />
    </nav>
  );
}

const EMPTY = new Map<string, string>();

/** Rola até o artigo já presente na página, sem recarregar. */
function scrollToArticle(anchor: string) {
  const el = document.getElementById(anchor);
  if (!el) return false;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  return true;
}

function NavList({
  spaceSlug,
  nodes,
  activePath,
  depth,
  open,
  toggle,
  onNavigate,
  activeId,
  onPage,
}: {
  spaceSlug: string;
  nodes: PortalTreeNode[];
  activePath: string;
  depth: number;
  open: Set<string>;
  toggle: (id: string) => void;
  onNavigate?: () => void;
  activeId: string | null;
  onPage: Map<string, string>;
}) {
  return (
    // Trilho de guia só nos níveis aninhados: no primeiro nível ele viraria
    // uma régua vertical inútil ao lado de tudo.
    <ul className={cn(depth > 0 && "ml-3 border-l border-border pl-2")}>
      {nodes
        .filter((n) => n.type !== "divider")
        .map((node) => {
          const path = node.slugPath.join("/");
          const anchor = onPage.get(node.id);
          // Se algum artigo desta página está sendo lido, ele manda no destaque.
          const isActive = activeId ? activeId === node.id : activePath === path;
          const href =
            node.type === "link" && node.link_url ? node.link_url : `/docs/${spaceSlug}/${path}`;
          const hasChildren = node.children.length > 0;
          const isOpen = open.has(node.id);

          return (
            <li key={node.id} className="relative py-px">
              {/* Estado ativo = barra + peso, não fundo colorido. Sobre o trilho
                  aninhado a barra substitui a guia; no primeiro nível ela fica
                  na margem. (padrão Apple Developer / Microsoft Learn) */}
              {isActive && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute inset-y-1 w-0.5 rounded-full bg-primary",
                    depth > 0 ? "-left-[9px]" : "-left-2",
                  )}
                />
              )}
              <div className="flex items-center gap-0.5">
                {hasChildren ? (
                  <button
                    type="button"
                    onClick={() => toggle(node.id)}
                    aria-label={isOpen ? "Recolher" : "Expandir"}
                    aria-expanded={isOpen}
                    className="flex size-6 shrink-0 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
                  >
                    <ChevronRight
                      className={cn(
                        "size-3.5 transition-transform motion-reduce:transition-none",
                        isOpen && "rotate-90",
                      )}
                    />
                  </button>
                ) : (
                  <span className="w-6 shrink-0" />
                )}
                <Link
                  href={href}
                  onClick={(e) => {
                    if (anchor && scrollToArticle(anchor)) {
                      e.preventDefault();
                      window.history.replaceState(null, "", href);
                    }
                    onNavigate?.();
                  }}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-1.5 rounded-sm px-2 py-1.5 leading-snug transition-colors",
                    // Hover com fundo na linha inteira (Microsoft Learn): o alvo
                    // fica evidente sem depender só da cor do texto.
                    isActive
                      ? "font-semibold text-primary"
                      : node.type === "folder"
                        ? "font-medium text-text hover:bg-surface-2 hover:text-primary"
                        : "text-text-muted hover:bg-surface-2 hover:text-text",
                  )}
                >
                  <span className="truncate">{node.title}</span>
                  {node.type === "link" && (
                    <ExternalLink className="size-3 shrink-0 opacity-60" aria-label="Link externo" />
                  )}
                </Link>
              </div>
              {hasChildren && isOpen && (
                <NavList
                  spaceSlug={spaceSlug}
                  nodes={node.children}
                  activePath={activePath}
                  depth={depth + 1}
                  open={open}
                  toggle={toggle}
                  onNavigate={onNavigate}
                  activeId={activeId}
                  onPage={onPage}
                />
              )}
            </li>
          );
        })}
    </ul>
  );
}
