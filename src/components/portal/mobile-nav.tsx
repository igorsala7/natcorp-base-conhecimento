"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { PortalNav } from "@/components/portal/nav";
import type { PortalTreeNode } from "@/lib/portal/data";

/** Botão + drawer de navegação para telas pequenas (< lg). */
export function PortalMobileNav({
  spaceSlug,
  tree,
  activePath,
}: {
  spaceSlug: string;
  tree: PortalTreeNode[];
  activePath: string;
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
          <div className="relative flex h-dvh w-[85%] max-w-xs flex-col border-r border-border bg-bg shadow-2xl motion-safe:animate-[slideinleft_200ms_ease-out]">
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
              <PortalNav
                spaceSlug={spaceSlug}
                tree={tree}
                activePath={activePath}
                onNavigate={() => setOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
