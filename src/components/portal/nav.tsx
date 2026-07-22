"use client";

import Link from "next/link";
import { ExternalLink, Folder } from "lucide-react";
import { cn } from "@/lib/utils";
import { ICONS } from "@/lib/blocks/icons";
import type { PortalTreeNode } from "@/lib/portal/data";
import { useActiveArticle } from "./active-article";

/**
 * Navegação lateral do portal — CÓPIA da navegação da página de artigo da
 * referência: seção de topo como EYEBROW em caps (ícone + nome) e os artigos
 * numa lista rail contínua (`border-l` com o item sobrepondo em `border-l-2`),
 * SEMPRE expandida — a referência não tem botões de expandir. O destaque do
 * artigo em leitura (scroll-spy) e o rolar-em-vez-de-navegar continuam.
 */
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
  const reading = useActiveArticle();
  const activeId = reading?.activeId ?? null;
  const onPage = reading?.onPage ?? EMPTY;

  const secoes = tree.filter((n) => n.type === "folder" && n.children.length > 0);
  const soltos = tree.filter((n) => n.type !== "folder" && n.type !== "divider");

  return (
    <nav aria-label="Navegação da documentação" className="space-y-6">
      {soltos.length > 0 && (
        <RailList
          spaceSlug={spaceSlug}
          nodes={soltos}
          activePath={activePath}
          depth={0}
          activeId={activeId}
          onPage={onPage}
          onNavigate={onNavigate}
        />
      )}
      {secoes.map((secao) => {
        const path = secao.slugPath.join("/");
        const Icone = (secao.icon && ICONS[secao.icon]) || Folder;
        return (
          <div key={secao.id}>
            {/* Eyebrow da referência: ícone + nome da seção em caps. */}
            <Link
              href={`/docs/${spaceSlug}/${path}`}
              onClick={() => onNavigate?.()}
              className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-muted transition-colors hover:text-primary"
            >
              <Icone className="size-3.5 shrink-0" />
              <span className="truncate">{secao.title}</span>
            </Link>
            <RailList
              spaceSlug={spaceSlug}
              nodes={secao.children}
              activePath={activePath}
              depth={0}
              activeId={activeId}
              onPage={onPage}
              onNavigate={onNavigate}
            />
          </div>
        );
      })}
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

function RailList({
  spaceSlug,
  nodes,
  activePath,
  depth,
  activeId,
  onPage,
  onNavigate,
}: {
  spaceSlug: string;
  nodes: PortalTreeNode[];
  activePath: string;
  depth: number;
  activeId: string | null;
  onPage: Map<string, string>;
  onNavigate?: () => void;
}) {
  return (
    <ul className={cn("space-y-0.5 border-l border-border", depth > 0 && "ml-3")}>
      {nodes
        .filter((n) => n.type !== "divider")
        .map((node) => {
          const path = node.slugPath.join("/");
          const anchor = onPage.get(node.id);
          const isActive = activeId ? activeId === node.id : activePath === path;
          const href =
            node.type === "link" && node.link_url ? node.link_url : `/docs/${spaceSlug}/${path}`;
          return (
            <li key={node.id}>
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
                // Classes EXATAS do item da referência.
                className={cn(
                  "-ml-px flex items-center gap-1.5 border-l-2 py-1.5 pl-3 text-[0.8125rem] leading-snug transition-colors",
                  isActive
                    ? "border-primary font-semibold text-primary"
                    : cn(
                        "border-transparent hover:border-border-strong",
                        node.type === "folder"
                          ? "font-medium text-text hover:text-primary"
                          : "text-text-muted hover:text-text",
                      ),
                )}
              >
                <span className="min-w-0 truncate">{node.title}</span>
                {node.type === "link" && (
                  <ExternalLink className="size-3 shrink-0 opacity-60" aria-label="Link externo" />
                )}
              </Link>
              {node.children.length > 0 && (
                <RailList
                  spaceSlug={spaceSlug}
                  nodes={node.children}
                  activePath={activePath}
                  depth={depth + 1}
                  activeId={activeId}
                  onPage={onPage}
                  onNavigate={onNavigate}
                />
              )}
            </li>
          );
        })}
    </ul>
  );
}
