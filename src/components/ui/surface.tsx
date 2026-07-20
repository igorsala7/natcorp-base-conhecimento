import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Superfície canônica (card, painel, caixa).
 *
 * Existe para acabar com o "cada caixa com sua borda": antes cada componente
 * escolhia raio, borda, padding e sombra por conta própria — é o que faz uma
 * interface parecer improvisada.
 *
 * Elevação:
 *  - 0 → só espaçamento, SEM borda. O padrão em documentação enterprise
 *        (Apple/MS/SAP separam por ar, não por traço).
 *  - 1 → borda hairline. Agrupa sem pesar.
 *  - 2 → borda + sombra curta. Só para o que flutua (popover, menu).
 */
const ELEVATION = {
  0: "",
  1: "border border-border bg-surface",
  2: "border border-border bg-surface shadow-2",
} as const;

const PADDING = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
} as const;

export type SurfaceProps = React.HTMLAttributes<HTMLDivElement> & {
  elevation?: keyof typeof ELEVATION;
  padding?: keyof typeof PADDING;
  asChild?: never;
};

export const Surface = React.forwardRef<HTMLDivElement, SurfaceProps>(
  ({ className, elevation = 1, padding = "md", ...props }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-lg", ELEVATION[elevation], PADDING[padding], className)}
      {...props}
    />
  ),
);
Surface.displayName = "Surface";
