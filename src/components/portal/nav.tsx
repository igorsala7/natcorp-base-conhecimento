"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, FileText, Folder, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PortalTreeNode } from "@/lib/portal/data";

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

  return (
    <nav aria-label="Navegação da documentação" className="text-sm">
      <NavList
        spaceSlug={spaceSlug}
        nodes={tree}
        activePath={activePath}
        depth={0}
        open={open}
        toggle={toggle}
        onNavigate={onNavigate}
      />
    </nav>
  );
}

function NavList({
  spaceSlug,
  nodes,
  activePath,
  depth,
  open,
  toggle,
  onNavigate,
}: {
  spaceSlug: string;
  nodes: PortalTreeNode[];
  activePath: string;
  depth: number;
  open: Set<string>;
  toggle: (id: string) => void;
  onNavigate?: () => void;
}) {
  return (
    <ul className={cn(depth > 0 && "ml-2.5 border-l border-border pl-2")}>
      {nodes
        .filter((n) => n.type !== "divider")
        .map((node) => {
          const path = node.slugPath.join("/");
          const isActive = activePath === path;
          const href =
            node.type === "link" && node.link_url ? node.link_url : `/docs/${spaceSlug}/${path}`;
          const hasChildren = node.children.length > 0;
          const isOpen = open.has(node.id);
          const Icon = node.type === "folder" ? Folder : node.type === "link" ? ExternalLink : FileText;

          return (
            <li key={node.id} className="py-0.5">
              <div className="flex items-center gap-0.5">
                {hasChildren ? (
                  <button
                    type="button"
                    onClick={() => toggle(node.id)}
                    aria-label={isOpen ? "Recolher" : "Expandir"}
                    aria-expanded={isOpen}
                    className="flex size-6 shrink-0 items-center justify-center rounded text-text-muted hover:bg-surface-2"
                  >
                    <ChevronRight className={cn("size-3.5 transition-transform", isOpen && "rotate-90")} />
                  </button>
                ) : (
                  <span className="w-6 shrink-0" />
                )}
                <Link
                  href={href}
                  onClick={onNavigate}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1.5 transition",
                    isActive
                      ? "bg-brand-purple-50 font-medium text-primary dark:bg-brand-purple-950/40"
                      : "text-text-muted hover:bg-surface-2 hover:text-text",
                    node.type === "folder" && !isActive && "font-medium text-text",
                  )}
                >
                  <Icon className="size-4 shrink-0 opacity-70" />
                  <span className="truncate">{node.title}</span>
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
                />
              )}
            </li>
          );
        })}
    </ul>
  );
}
