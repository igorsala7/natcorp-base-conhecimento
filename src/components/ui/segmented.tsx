"use client";

import { cn } from "@/lib/utils";

/**
 * Toggle segmentado (padrão Lumina): container com fundo rebaixado e opção
 * ativa "elevada" em branco com sombra suave. Uso: Editor|Prévia, filtros de
 * lista (Todos/Publicados/Rascunhos).
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; title?: string }[];
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex rounded-md border border-border bg-surface-2 p-0.5",
        className,
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-colors [&_svg]:size-3.5",
            value === o.value
              ? "bg-surface text-text shadow-1"
              : "text-text-muted hover:text-text",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Rótulo de formulário no padrão Lumina (fonte única no Field). */
export { eyebrowLabel as luminaLabel } from "@/components/ui/field";

/** Botão tracejado "adicionar item" (listas editáveis do editor). */
export const addItemClass =
  "inline-flex items-center gap-1.5 rounded-md border border-dashed border-primary/50 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-brand-purple-50 dark:hover:bg-brand-purple-950/40";
