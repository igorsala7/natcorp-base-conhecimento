"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/**
 * Menu suspenso ancorado a um botão. Posiciona por coordenada FIXA (medida do
 * gatilho) para não ser cortado por contêineres com overflow — o caso da coluna
 * estreita da árvore. Fecha em clique-fora, Esc, rolagem e redimensionamento.
 *
 * `children` é uma função que recebe `close` — cada item decide se fecha o menu
 * ao agir (ações fecham; itens de checkbox de filtro NÃO fecham, para marcar
 * vários de uma vez).
 */
type Align = "start" | "end";

export function DropdownMenu({
  label,
  icon: Icon,
  title,
  align = "start",
  placement = "bottom",
  variant = "secondary",
  size = "sm",
  badge,
  disabled,
  chevron = true,
  panelWidth = 216,
  children,
}: {
  label?: string;
  icon?: LucideIcon;
  title?: string;
  align?: Align;
  /** "top" abre PARA CIMA — para gatilhos perto do rodapé da tela. */
  placement?: "bottom" | "top";
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "icon";
  badge?: ReactNode;
  disabled?: boolean;
  chevron?: boolean;
  panelWidth?: number;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = () => setOpen(false);
  function toggle() {
    if (open) return close();
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      const left =
        align === "end"
          ? Math.max(8, r.right - panelWidth)
          : Math.min(r.left, window.innerWidth - panelWidth - 8);
      setPos(
        placement === "top"
          ? { left, bottom: window.innerHeight - r.top + 6 }
          : { left, top: r.bottom + 6 },
      );
    }
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !btnRef.current?.contains(t)) close();
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onMove = () => close();
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open]);

  return (
    <>
      <Button
        ref={btnRef}
        type="button"
        size={size}
        variant={variant}
        title={title}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      >
        {Icon && <Icon className="size-4" />}
        {label}
        {badge}
        {chevron && (
          <ChevronDown className={cn("size-3.5 opacity-60 transition-transform", open && "rotate-180")} />
        )}
      </Button>
      {open &&
        pos &&
        typeof document !== "undefined" &&
        // PORTAL no body: sem isto, `position: fixed` fica relativo a um
        // ancestral com `transform` (ex.: o card `.animate-fade-up`) e o menu
        // abre fora do lugar. No body não há ancestral transformado.
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            style={{ left: pos.left, top: pos.top, bottom: pos.bottom, width: panelWidth }}
            className="fixed z-50 rounded-xl border border-border bg-surface p-1.5 shadow-2"
          >
            {children(close)}
          </div>,
          document.body,
        )}
    </>
  );
}

/** Item de ação. `danger` pinta em vermelho (ações destrutivas, ex.: excluir). */
export function MenuItem({
  icon: Icon,
  children,
  onClick,
  disabled,
  hint,
  danger,
}: {
  icon?: LucideIcon;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  hint?: ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors disabled:pointer-events-none disabled:opacity-40",
        danger
          ? "text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
          : "text-text hover:bg-surface-2",
      )}
    >
      {Icon && (
        <Icon className={cn("size-4 shrink-0", danger ? "text-rose-600 dark:text-rose-400" : "text-text-muted")} />
      )}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint != null && (
        <span className="shrink-0 rounded-full bg-surface-2 px-1.5 text-xs font-medium text-text-muted">{hint}</span>
      )}
    </button>
  );
}

/** Item alternável (checkbox), com bolinha de cor opcional. Não fecha o menu. */
export function MenuCheckItem({
  checked,
  dot,
  children,
  onClick,
}: {
  checked: boolean;
  dot?: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm text-text transition-colors hover:bg-surface-2"
    >
      <span
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors",
          checked ? "border-primary bg-primary text-white" : "border-border-strong",
        )}
      >
        {checked && <Check className="size-3" strokeWidth={3} />}
      </span>
      {dot && <span className={cn("size-1.5 shrink-0 rounded-full", dot)} />}
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-border" />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
      {children}
    </div>
  );
}
