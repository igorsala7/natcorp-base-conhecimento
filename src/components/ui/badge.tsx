import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Etiqueta de estado. Existiam três escalas diferentes no admin
 * (`text-2xs`, `text-xs`, `text-sm`) — aqui há uma só.
 *
 * A cor nunca carrega o significado sozinha: o texto do badge sempre diz o
 * estado por extenso ("Rascunho", "Publicado"), então quem não distingue as
 * cores continua entendendo.
 */
/**
 * Os quatro tons de estado vêm de TOKEN, não da escala crua do Tailwind.
 *
 * Eram `emerald`, `sky`, `amber` e `rose` com uma variante `dark:` escrita à
 * mão em cada um. Três problemas de uma vez: matiz de outro produto ao lado do
 * roxo da marca, contraste nunca medido, e a mesma decisão repetida em mais 60
 * arquivos porque não havia token para reaproveitar.
 *
 * Com token, o `dark:` some do call site — a variável já muda de valor no tema
 * escuro. Era exatamente o `dark:` esquecido que quebrava telas em silêncio.
 */
const TONES = {
  neutral: "bg-surface-2 text-text-muted",
  success: "bg-success-soft text-success",
  primary: "bg-brand-purple-50 text-primary dark:bg-brand-purple-950/40 dark:text-brand-purple-200",
  accent: "bg-brand-pink-50 text-accent dark:bg-brand-pink-950/40 dark:text-brand-pink-200",
  info: "bg-info-soft text-info",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
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
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-bold uppercase tracking-[0.05em] leading-tight",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
