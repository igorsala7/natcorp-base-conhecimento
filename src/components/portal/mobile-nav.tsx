"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { PortalNav } from "@/components/portal/nav";
import type { PortalTreeNode } from "@/lib/portal/data";
import type { ThemeLink } from "@/lib/portal/theme";

/** Botão + drawer de navegação para telas pequenas (< lg). */
export function PortalMobileNav({
  spaceSlug,
  tree,
  activePath,
  links = [],
}: {
  spaceSlug: string;
  tree: PortalTreeNode[];
  activePath: string;
  /** Links do tema (cabeçalho) — no mobile eles moram no drawer. */
  links?: ThemeLink[];
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir navegação"
        className="flex size-9 items-center justify-center rounded-lg border border-border text-text-muted hover:text-text lg:hidden"
      >
        <Menu className="size-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-label="Navegação">
          <div
            className="absolute inset-0 bg-black/40 motion-safe:animate-[fade_150ms_ease-out]"
            onClick={() => setOpen(false)}
          />
          <div className="relative flex h-dvh w-[85%] max-w-xs flex-col border-r border-border bg-surface shadow-3 motion-safe:animate-[slideinleft_200ms_ease-out]">
            <div className="flex h-14 items-center justify-between border-b border-border px-4">
              <span className="font-semibold">Documentação</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar"
                className="rounded p-1.5 text-text-muted hover:bg-surface-2 hover:text-text"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-3">
              {tree.length > 0 && (
                <PortalNav
                  spaceSlug={spaceSlug}
                  tree={tree}
                  activePath={activePath}
                  onNavigate={() => setOpen(false)}
                />
              )}
            </div>
            {links.length > 0 && (
              <nav aria-label="Links do site" className="border-t border-border p-3">
                {links.map((l) => {
                  const externo = /^https?:\/\//.test(l.url);
                  return (
                    <a
                      key={`${l.label}-${l.url}`}
                      href={l.url}
                      {...(externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      className="flex items-center gap-1 rounded-md px-2 py-2 text-sm text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
                    >
                      {l.label}
                      {externo && <ArrowUpRight className="size-3.5 opacity-60" />}
                    </a>
                  );
                })}
              </nav>
            )}
          </div>
        </div>
      )}
    </>
  );
}
