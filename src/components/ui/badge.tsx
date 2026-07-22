import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Etiqueta de estado. Existiam três escalas diferentes no admin
 * (`text-[10px]`, `text-xs`, `text-sm`) — aqui há uma só.
 *
 * A cor nunca carrega o significado sozinha: o texto do badge sempre diz o
 * estado por extenso ("Rascunho", "Publicado"), então quem não distingue as
 * cores continua entendendo.
 */
const TONES = {
  neutral: "bg-surface-2 text-text-muted",
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  primary: "bg-brand-purple-50 text-primary dark:bg-brand-purple-950/40 dark:text-brand-purple-200",
  accent: "bg-brand-pink-50 text-accent dark:bg-brand-pink-950/40 dark:text-brand-pink-200",
  info: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  danger: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
} as const;

export type BadgeTone = keyof typeof TONES;

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] leading-tight",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
