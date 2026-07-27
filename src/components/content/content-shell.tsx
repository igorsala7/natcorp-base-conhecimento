"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const KEY = "kb.treeWidth";
const KEY_COLAPSO = "kb.treeCollapsed"; // sufixado por contexto (editor/nav)
const MIN = 200;
const MAX = 680;
const DEFAULT = 288; // = w-72

/**
 * Layout de duas colunas: navegação (esquerda) + área de edição (direita).
 * A coluna da árvore é redimensionável (largura persistida) e RECOLHÍVEL —
 * na página do EDITOR ela começa recolhida (padrão da referência: o editor
 * ocupa a tela; a árvore expande sob demanda pelo trilho).
 */
export function ContentShell({
  aside,
  children,
  defaultCollapsed = false,
}: {
  aside: ReactNode;
  children: ReactNode;
  /** Começa com a árvore recolhida num trilho fino (página do editor). */
  defaultCollapsed?: boolean;
}) {
  const [width, setWidth] = useState(DEFAULT);
  const [dragging, setDragging] = useState(false);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const widthRef = useRef(DEFAULT);
  const chaveColapso = `${KEY_COLAPSO}.${defaultCollapsed ? "editor" : "nav"}`;

  useEffect(() => {
    const saved = Number(localStorage.getItem(KEY));
    if (saved >= MIN && saved <= MAX) {
      widthRef.current = saved;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWidth(saved);
    }
    // A escolha manual (expandir/recolher) vence o default da página.
    const colapso = localStorage.getItem(chaveColapso);
    if (colapso === "1" || colapso === "0") {
      setCollapsed(colapso === "1");
    }
  }, [chaveColapso]);

  // O editor pede para recolher a árvore ao selecionar um bloco (mais espaço
  // para editar). Evento global — só o editor o dispara.
  useEffect(() => {
    function recolher() {
      setCollapsed(true);
      localStorage.setItem(chaveColapso, "1");
    }
    window.addEventListener("kb:collapse-tree", recolher);
    return () => window.removeEventListener("kb:collapse-tree", recolher);
  }, [chaveColapso]);

  function alternar() {
    setCollapsed((c) => {
      localStorage.setItem(chaveColapso, c ? "0" : "1");
      return !c;
    });
  }

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

  if (collapsed) {
    return (
      <div data-fullbleed className="flex h-full">
        {/* Trilho fino: a árvore está a um clique. Botão destacado (acento roxo). */}
        <aside className="mr-3 flex w-11 shrink-0 flex-col items-center rounded-lg border border-border bg-surface py-2">
          <button
            type="button"
            onClick={alternar}
            title="Mostrar a árvore de conteúdo"
            aria-label="Mostrar a árvore de conteúdo"
            aria-expanded={false}
            className="flex size-8 items-center justify-center rounded-lg border border-brand-purple-200 bg-brand-purple-50 text-primary transition-colors hover:bg-brand-purple-100 dark:border-brand-purple-900 dark:bg-brand-purple-950/50 dark:hover:bg-brand-purple-900/60"
          >
            <PanelLeftOpen className="size-4" />
          </button>
        </aside>
        <section className="min-w-0 flex-1 overflow-auto">{children}</section>
      </div>
    );
  }

  return (
    <div data-fullbleed className="flex h-full">
      <aside
        style={{ width }}
        className="flex shrink-0 flex-col overflow-auto rounded-lg border border-border bg-surface p-3"
      >
        <div className="mb-1 flex justify-end">
          <button
            type="button"
            onClick={alternar}
            title="Recolher a árvore (mais espaço para editar)"
            aria-label="Recolher a árvore"
            aria-expanded
            className="flex items-center gap-1.5 rounded-lg border border-brand-purple-200 bg-brand-purple-50 px-2 py-1 text-xs font-medium text-primary shadow-sm transition-colors hover:bg-brand-purple-100 dark:border-brand-purple-900 dark:bg-brand-purple-950/50 dark:hover:bg-brand-purple-900/60"
          >
            <PanelLeftClose className="size-4" />
            Recolher
          </button>
        </div>
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
