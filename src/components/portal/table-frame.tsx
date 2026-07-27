"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Maximize2, X } from "lucide-react";

/**
 * Moldura da tabela no portal: rola na horizontal (como antes) e, quando a
 * tabela é MAIS LARGA que a coluna do artigo (dados escondidos pelo scroll),
 * mostra o botão "Expandir" que abre a tabela numa sobreposição grande, onde dá
 * para ver todas as colunas. Recebe o `<table>` já renderizado (server) como
 * children — o mesmo é reaproveitado inline e na sobreposição.
 */
export function TableFrame({
  borders = "rows",
  striped = true,
  children,
}: {
  borders?: "all" | "rows" | "none";
  striped?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [overflow, setOverflow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const medir = () => {
      const el = ref.current;
      if (el) setOverflow(el.scrollWidth > el.clientWidth + 2);
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const attrs = { "data-borders": borders, "data-striped": String(striped) };

  return (
    <div className="relative my-4">
      <div
        ref={ref}
        className="table-portal overflow-x-auto rounded-lg border border-border shadow-1"
        {...attrs}
      >
        {children}
      </div>
      {overflow && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Expandir a tabela para ver todas as colunas"
          className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-md border border-border bg-surface/90 px-2 py-1 text-xs font-medium text-text-muted shadow-1 backdrop-blur transition-colors hover:text-text"
        >
          <Maximize2 className="size-3.5" /> Expandir
        </button>
      )}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
            onClick={() => setOpen(false)}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="flex max-h-[92vh] max-w-[96vw] flex-col overflow-hidden rounded-xl bg-bg shadow-2"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-2">
                <span className="text-sm font-medium text-text-muted">Tabela ampliada</span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  title="Fechar (Esc)"
                  className="flex size-7 items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="table-portal overflow-auto p-3" {...attrs}>
                {children}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
