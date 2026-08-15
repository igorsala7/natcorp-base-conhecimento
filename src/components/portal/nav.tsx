"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, ExternalLink, Folder } from "lucide-react";
import { cn } from "@/lib/utils";
import { ICONS } from "@/lib/blocks/icons";
import type { PortalTreeNode } from "@/lib/portal/data";
import { scrollToElement } from "@/lib/portal/scroll";
import { useActiveArticle } from "./active-article";

/**
 * Navegação lateral do portal — árvore colapsável de design moderno (sem "+/−":
 * a afordância é a setinha que gira). Ao abrir, só o ramo do artigo em foco fica
 * aberto. Ao rolar (scroll-spy de `useActiveArticle`), o ramo do artigo atual é
 * AUTO-EXPANDIDO e destacado, e a árvore rola dentro da própria coluna para
 * mantê-lo à vista — mas NADA é recolhido automaticamente. Recolher os outros
 * ramos durante a rolagem fazia a árvore refluir a cada scroll: o item "fugia"
 * do cursor (clicava e caía em outro) e o destaque se perdia. Abrir/fechar
 * manual persiste.
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
  // Ao clicar, destaca o item na hora (o scroll-spy confirma quando a rolagem
  // chega) — evita o piscar do destaque pelos artigos intermediários.
  const setAtivo = useCallback(
    (id: string) => reading?.setActiveId(id),
    [reading],
  );

  // Índice pai→filho e caminho→id, para achar os ancestrais do artigo em foco.
  const { parentOf, byPath } = useMemo(() => construirIndices(tree), [tree]);
  const focoId = activeId ?? byPath.get(activePath) ?? null;
  const ancestrais = useMemo(() => {
    const s = new Set<string>();
    let cur: string | null = focoId;
    for (let i = 0; cur && i < 100; i++) {
      s.add(cur);
      cur = parentOf.get(cur) ?? null;
    }
    return s;
  }, [focoId, parentOf]);

  // Ramo do foco começa aberto. Ao trocar o foco (rolagem), só ADICIONA os
  // ancestrais do artigo atual — nunca recolhe os outros. Recolher durante a
  // rolagem fazia o clique cair no item errado. Manual persiste.
  const [expandido, setExpandido] = useState<Set<string>>(ancestrais);
  const focoRef = useRef(focoId);
  useEffect(() => {
    if (focoRef.current === focoId) return;
    focoRef.current = focoId;
    setExpandido((prev) => {
      let mudou = false;
      const next = new Set(prev);
      for (const id of ancestrais)
        if (!next.has(id)) {
          next.add(id);
          mudou = true;
        }
      return mudou ? next : prev;
    });
  }, [focoId, ancestrais]);

  // Mantém o item ativo VISÍVEL dentro da rolagem da própria árvore (nunca mexe
  // na janela) — em árvores grandes o destaque sumia abaixo da dobra e você
  // "perdia a referência" do que está lendo.
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const item = nav.querySelector<HTMLElement>('[aria-current="page"]');
    if (!item || item.offsetParent === null) return;
    const cont = rolagemAncestral(nav);
    if (!cont) return;
    const ir = item.getBoundingClientRect();
    const cr = cont.getBoundingClientRect();
    if (ir.top < cr.top) cont.scrollTop -= cr.top - ir.top + 8;
    else if (ir.bottom > cr.bottom) cont.scrollTop += ir.bottom - cr.bottom + 8;
  }, [focoId]);

  const toggle = useCallback((id: string) => {
    setExpandido((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const secoes = tree.filter((n) => n.type === "folder" && n.children.length > 0);
  const soltos = tree.filter((n) => n.type !== "folder" && n.type !== "divider");

  return (
    <nav ref={navRef} aria-label="Navegação da documentação" className="space-y-4">
      {soltos.length > 0 && (
        <RailList
          spaceSlug={spaceSlug}
          nodes={soltos}
          activePath={activePath}
          depth={0}
          activeId={activeId}
          onPage={onPage}
          onNavigate={onNavigate}
          setAtivo={setAtivo}
          expandido={expandido}
          toggle={toggle}
        />
      )}
      {secoes.map((secao) => {
        const path = secao.slugPath.join("/");
        const Icone = (secao.icon && ICONS[secao.icon]) || Folder;
        const aberto = expandido.has(secao.id);
        return (
          <div key={secao.id}>
            {/* Cabeçalho de seção: setinha (gira ao abrir) + eyebrow em caps. */}
            <div className="mb-2 flex items-center gap-1">
              <button
                type="button"
                onClick={() => toggle(secao.id)}
                aria-expanded={aberto}
                aria-label={aberto ? "Recolher seção" : "Expandir seção"}
                className="shrink-0 rounded p-0.5 text-text-muted transition-colors hover:text-primary"
              >
                <ChevronRight
                  className={cn(
                    "size-3.5 transition-transform duration-200 ease-out motion-reduce:transition-none",
                    aberto && "rotate-90",
                  )}
                />
              </button>
              <Link
                href={`/docs/${spaceSlug}/${path}`}
                onClick={(e) => {
                  // Seção presente nesta página → rola até ela em vez de recarregar.
                  const anchor = onPage.get(secao.id);
                  if (anchor && scrollToArticle(anchor)) {
                    e.preventDefault();
                    setAtivo(secao.id);
                  }
                  onNavigate?.();
                }}
                className="flex min-w-0 flex-1 items-start gap-2 text-xs font-bold uppercase tracking-wider text-text-muted transition-colors hover:text-primary"
              >
                <Icone className="mt-0.5 size-3.5 shrink-0" />
                <span className="min-w-0 [overflow-wrap:anywhere]">{secao.title}</span>
              </Link>
            </div>
            <div
              className={cn(
                "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
                aberto ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <div className="overflow-hidden">
                <RailList
                  spaceSlug={spaceSlug}
                  nodes={secao.children}
                  activePath={activePath}
                  depth={0}
                  activeId={activeId}
                  onPage={onPage}
                  onNavigate={onNavigate}
                  setAtivo={setAtivo}
                  expandido={expandido}
                  toggle={toggle}
                />
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

const EMPTY = new Map<string, string>();

/** Ancestral rolável mais próximo — a coluna com `overflow-y-auto` da árvore. */
function rolagemAncestral(el: HTMLElement): HTMLElement | null {
  let cur = el.parentElement;
  while (cur) {
    const oy = getComputedStyle(cur).overflowY;
    if (oy === "auto" || oy === "scroll") return cur;
    cur = cur.parentElement;
  }
  return null;
}

/** Índices auxiliares: id do pai de cada nó e id por caminho de slug. */
function construirIndices(tree: PortalTreeNode[]): {
  parentOf: Map<string, string | null>;
  byPath: Map<string, string>;
} {
  const parentOf = new Map<string, string | null>();
  const byPath = new Map<string, string>();
  const walk = (nodes: PortalTreeNode[], parent: string | null) => {
    for (const n of nodes) {
      parentOf.set(n.id, parent);
      byPath.set(n.slugPath.join("/"), n.id);
      if (n.children.length) walk(n.children, n.id);
    }
  };
  walk(tree, null);
  return { parentOf, byPath };
}

/** Rola até o artigo/seção já presente na página, sem recarregar. */
function scrollToArticle(anchor: string) {
  const el = document.getElementById(anchor);
  if (!el) return false;
  scrollToElement(el);
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
  setAtivo,
  expandido,
  toggle,
}: {
  spaceSlug: string;
  nodes: PortalTreeNode[];
  activePath: string;
  depth: number;
  activeId: string | null;
  onPage: Map<string, string>;
  onNavigate?: () => void;
  setAtivo: (id: string) => void;
  expandido: Set<string>;
  toggle: (id: string) => void;
}) {
  return (
    <ul className={cn("space-y-0.5 border-l border-border", depth > 0 && "ml-3")}>
      {nodes
        .filter((n) => n.type !== "divider")
        .map((node) => {
          const path = node.slugPath.join("/");
          const anchor = onPage.get(node.id);
          const isActive = activeId ? activeId === node.id : activePath === path;
          const ehPasta = node.type === "folder" && node.children.length > 0;
          const aberto = expandido.has(node.id);
          const href =
            node.type === "link" && node.link_url ? node.link_url : `/docs/${spaceSlug}/${path}`;
          return (
            <li key={node.id}>
              <div className="-ml-px flex items-stretch">
                {/* Setinha só para pasta; folha ganha um respiro do mesmo tamanho
                    para os títulos alinharem. Sem "+/−" — a seta gira. */}
                {ehPasta ? (
                  <button
                    type="button"
                    onClick={() => toggle(node.id)}
                    aria-expanded={aberto}
                    aria-label={aberto ? "Recolher" : "Expandir"}
                    className="flex w-4 shrink-0 items-center justify-center border-l-2 border-transparent text-text-muted transition-colors hover:text-primary"
                  >
                    <ChevronRight
                      className={cn(
                        "size-3.5 transition-transform duration-200 ease-out motion-reduce:transition-none",
                        aberto && "rotate-90",
                      )}
                    />
                  </button>
                ) : (
                  <span className="w-2 shrink-0" />
                )}
                <Link
                  href={href}
                  onClick={(e) => {
                    // Item presente nesta página → rola até a seção dele (mesmo
                    // id), sem recarregar. Fora da página → navega normal.
                    if (anchor && scrollToArticle(anchor)) {
                      e.preventDefault();
                      setAtivo(node.id);
                    }
                    onNavigate?.();
                  }}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex min-w-0 flex-1 items-start gap-1.5 border-l-2 py-1.5 pl-2 text-[0.8125rem] leading-snug transition-colors",
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
                  <span className="min-w-0 [overflow-wrap:anywhere]">{node.title}</span>
                  {node.type === "link" && (
                    <ExternalLink className="mt-0.5 size-3.5 shrink-0 opacity-60" aria-label="Link externo" />
                  )}
                </Link>
              </div>
              {ehPasta && (
                <div
                  className={cn(
                    "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
                    aberto ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                  )}
                >
                  <div className="overflow-hidden">
                    <RailList
                      spaceSlug={spaceSlug}
                      nodes={node.children}
                      activePath={activePath}
                      depth={depth + 1}
                      activeId={activeId}
                      onPage={onPage}
                      onNavigate={onNavigate}
                      setAtivo={setAtivo}
                      expandido={expandido}
                      toggle={toggle}
                    />
                  </div>
                </div>
              )}
            </li>
          );
        })}
    </ul>
  );
}
