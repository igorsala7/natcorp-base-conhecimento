"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Painel lateral FIXO (altura total, rola sozinho — NÃO acompanha a rolagem do
 * conteúdo) e REDIMENSIONÁVEL arrastando a alça. Mesmo comportamento da árvore
 * (ContentShell), reutilizável em qualquer página com painel de propriedades.
 *
 * `side`: "right" = alça à ESQUERDA do painel (arrastar p/ a esquerda aumenta);
 * "left" = alça à direita. A largura é persistida por `storageKey`.
 */
export function ResizablePanel({
  storageKey,
  side = "right",
  min = 240,
  max = 620,
  defaultWidth = 320,
  className,
  children,
}: {
  storageKey: string;
  side?: "left" | "right";
  min?: number;
  max?: number;
  defaultWidth?: number;
  className?: string;
  children: ReactNode;
}) {
  const [width, setWidth] = useState(defaultWidth);
  const [dragging, setDragging] = useState(false);
  const widthRef = useRef(defaultWidth);

  useEffect(() => {
    const saved = Number(localStorage.getItem(storageKey));
    if (saved >= min && saved <= max) {
      widthRef.current = saved;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWidth(saved);
    }
  }, [storageKey, min, max]);

  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = widthRef.current;
    setDragging(true);
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const w = Math.min(max, Math.max(min, side === "right" ? startW - dx : startW + dx));
      widthRef.current = w;
      setWidth(w);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setDragging(false);
      localStorage.setItem(storageKey, String(widthRef.current));
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function reset() {
    widthRef.current = defaultWidth;
    setWidth(defaultWidth);
    localStorage.setItem(storageKey, String(defaultWidth));
  }

  const handle = (
    <div
      onPointerDown={onPointerDown}
      onDoubleClick={reset}
      role="separator"
      aria-orientation="vertical"
      title="Arraste para redimensionar (duplo clique para restaurar)"
      className={cn(
        "relative w-1.5 shrink-0 cursor-col-resize self-stretch rounded-full transition-colors",
        dragging ? "bg-primary" : "bg-transparent hover:bg-brand-purple-200",
      )}
    >
      <span className="absolute inset-y-0 -left-1.5 -right-1.5" />
    </div>
  );

  // Um ÚNICO item flexível (alça + conteúdo juntos) — assim o `gap` da linha não
  // separa a alça do painel. A alça fica na borda interna do painel.
  return (
    <div style={{ width }} className="flex h-full min-h-0 shrink-0">
      {side === "right" && handle}
      <div className={cn("flex min-h-0 min-w-0 flex-1", className)}>{children}</div>
      {side === "left" && handle}
    </div>
  );
}

/**
 * Estado de "recolhido/expandido" de um painel lateral, persistido em
 * `localStorage` (`<storageKey>.collapsed`). A escolha do usuário sobrevive à
 * navegação — quem recolheu a paleta continua com ela recolhida.
 */
export function useCollapsiblePanel(storageKey: string, initial = false) {
  const [collapsed, setCollapsed] = useState(initial);
  const chave = `${storageKey}.collapsed`;

  useEffect(() => {
    const v = localStorage.getItem(chave);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (v === "1" || v === "0") setCollapsed(v === "1");
  }, [chave]);

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      localStorage.setItem(chave, c ? "0" : "1");
      return !c;
    });
  }, [chave]);

  return { collapsed, toggle };
}

/**
 * Botão DESTACADO de recolher (no cabeçalho do painel expandido). Usa o acento
 * roxo da marca para saltar aos olhos — o pedido foi que recolher/expandir
 * fossem visíveis, não um ícone apagado.
 */
export function CollapseButton({
  side,
  onClick,
  label,
}: {
  side: "left" | "right";
  onClick: () => void;
  label: string;
}) {
  const Icon = side === "right" ? PanelRightClose : PanelLeftClose;
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Recolher ${label}`}
      aria-label={`Recolher ${label}`}
      className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-brand-purple-200 bg-brand-purple-50 text-primary shadow-sm transition-colors hover:bg-brand-purple-100 dark:border-brand-purple-900 dark:bg-brand-purple-950/50 dark:hover:bg-brand-purple-900/60"
    >
      <Icon className="size-4" />
    </button>
  );
}

/**
 * Trilho fino exibido quando o painel está recolhido: um botão DESTACADO para
 * expandir + conteúdo opcional (ex.: ícones de acesso rápido da paleta). Fixo
 * na altura, rola sozinho. Reutilizável na paleta e no inspetor.
 */
export function CollapsedRail({
  side,
  onExpand,
  label,
  children,
}: {
  side: "left" | "right";
  onExpand: () => void;
  label: string;
  children?: ReactNode;
}) {
  const Icon = side === "right" ? PanelRightOpen : PanelLeftOpen;
  return (
    <aside className="flex h-full w-11 shrink-0 flex-col items-center gap-1.5 rounded-xl border border-border bg-surface py-2 shadow-1">
      <button
        type="button"
        onClick={onExpand}
        title={`Expandir ${label}`}
        aria-label={`Expandir ${label}`}
        aria-expanded={false}
        className="flex size-8 items-center justify-center rounded-lg border border-brand-purple-200 bg-brand-purple-50 text-primary transition-colors hover:bg-brand-purple-100 dark:border-brand-purple-900 dark:bg-brand-purple-950/50 dark:hover:bg-brand-purple-900/60"
      >
        <Icon className="size-4" />
      </button>
      {children && (
        <div className="slim-scroll flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto pt-1">
          {children}
        </div>
      )}
    </aside>
  );
}
