"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const KEY = "kb.treeWidth";
const MIN = 200;
const MAX = 680;
const DEFAULT = 288; // = w-72

/**
 * Layout de duas colunas: navegação (esquerda) + área de edição (direita).
 * A coluna da árvore é redimensionável: arraste o divisor para alargar/reduzir
 * (útil quando as labels de artigos/pastas ficam cortadas). Largura persistida.
 */
export function ContentShell({
  aside,
  children,
}: {
  aside: ReactNode;
  children: ReactNode;
}) {
  const [width, setWidth] = useState(DEFAULT);
  const [dragging, setDragging] = useState(false);
  const widthRef = useRef(DEFAULT);

  useEffect(() => {
    const saved = Number(localStorage.getItem(KEY));
    if (saved >= MIN && saved <= MAX) {
      widthRef.current = saved;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWidth(saved);
    }
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = widthRef.current;
    setDragging(true);
    const onMove = (ev: PointerEvent) => {
      const w = Math.min(MAX, Math.max(MIN, startW + ev.clientX - startX));
      widthRef.current = w;
      setWidth(w);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setDragging(false);
      localStorage.setItem(KEY, String(widthRef.current));
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function reset() {
    widthRef.current = DEFAULT;
    setWidth(DEFAULT);
    localStorage.setItem(KEY, String(DEFAULT));
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)]">
      <aside
        style={{ width }}
        className="shrink-0 overflow-auto rounded-lg border border-border bg-surface p-3"
      >
        {aside}
      </aside>

      {/* Divisor arrastável */}
      <div
        onPointerDown={onPointerDown}
        onDoubleClick={reset}
        role="separator"
        aria-orientation="vertical"
        title="Arraste para redimensionar (duplo clique para restaurar)"
        className={cn(
          "relative mx-1 w-1.5 shrink-0 cursor-col-resize rounded-full transition-colors",
          dragging ? "bg-primary" : "bg-transparent hover:bg-brand-purple-200",
        )}
      >
        {/* alvo de clique mais largo que a barra visível */}
        <span className="absolute inset-y-0 -left-1.5 -right-1.5" />
      </div>

      <section className="min-w-0 flex-1 overflow-auto">{children}</section>
    </div>
  );
}
