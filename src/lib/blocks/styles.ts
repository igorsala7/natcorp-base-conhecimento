/**
 * Estilos por bloco → classes Tailwind, por mapa WHITELIST (nunca string
 * arbitrária em className, evitando injeção e mantendo o purge do Tailwind).
 * Isomórfico: usado pelo render do portal e pelo editor.
 */
import type { BlockStyles, SpaceScale } from "./schema";

const PAD_X: Record<SpaceScale, string> = { 0: "", 1: "px-2", 2: "px-3", 3: "px-4", 4: "px-6", 5: "px-8", 6: "px-12" };
const PAD_Y: Record<SpaceScale, string> = { 0: "", 1: "py-2", 2: "py-3", 3: "py-4", 4: "py-6", 5: "py-8", 6: "py-12" };
const MAR_Y: Record<SpaceScale, string> = { 0: "", 1: "my-2", 2: "my-3", 3: "my-4", 4: "my-6", 5: "my-8", 6: "my-12" };
const MIN_H: Record<SpaceScale, string> = { 0: "", 1: "min-h-16", 2: "min-h-24", 3: "min-h-32", 4: "min-h-48", 5: "min-h-64", 6: "min-h-96" };
const BG: Record<string, string> = {
  none: "",
  purple: "bg-brand-purple-50 dark:bg-brand-purple-950/30",
  pink: "bg-brand-pink-50 dark:bg-brand-pink-950/30",
  blue: "bg-brand-blue-50 dark:bg-brand-blue-950/30",
  gray: "bg-brand-gray-100 dark:bg-brand-gray-800",
  dark: "bg-brand-purple-900 text-white dark:bg-brand-purple-950",
};
const RADIUS: Record<string, string> = {
  none: "", sm: "rounded-sm", md: "rounded-md", lg: "rounded-lg", xl: "rounded-xl", "2xl": "rounded-2xl",
};
const ALIGN: Record<string, string> = { left: "text-left", center: "text-center", right: "text-right" };
/** Escala deslocada UM degrau abaixo do Tailwind: em documentação o "base"
 *  precisa valer 14px ("sm"), e assim por diante — os rótulos do painel
 *  continuam os mesmos, só o tamanho real encolhe. */
const FONT: Record<string, string> = {
  xs: "text-[0.6875rem]", sm: "text-xs", base: "text-sm", lg: "text-base",
  xl: "text-lg", "2xl": "text-xl", "3xl": "text-2xl",
};
const BORDER_W: Record<number, string> = { 0: "", 1: "border", 2: "border-2", 4: "border-4", 8: "border-8" };
const BORDER_C: Record<string, string> = {
  border: "border-border",
  primary: "border-primary",
  pink: "border-brand-pink-400",
  blue: "border-brand-blue-400",
  gray: "border-brand-gray-300",
  dark: "border-brand-purple-900",
};
const WIDTH: Record<string, string> = {
  auto: "", full: "w-full",
  half: "w-full sm:w-1/2",
  third: "w-full sm:w-1/3",
  twoThirds: "w-full sm:w-2/3",
  threeQuarters: "w-full sm:w-3/4",
};
/** Posição da região na página (quando não ocupa a largura toda). */
const JUSTIFY: Record<string, string> = {
  left: "mr-auto",
  center: "mx-auto",
  right: "ml-auto",
};

export function styleClass(s: BlockStyles | undefined): string {
  if (!s) return "";
  // Borda só faz sentido com largura definida; sem cor explícita usa a padrão.
  const hasBorder = !!s.borderWidth;
  return [
    s.paddingX != null && PAD_X[s.paddingX],
    s.paddingY != null && PAD_Y[s.paddingY],
    s.marginY != null && MAR_Y[s.marginY],
    s.minHeight != null && MIN_H[s.minHeight],
    s.bgColor && BG[s.bgColor],
    s.borderRadius && RADIUS[s.borderRadius],
    s.align && ALIGN[s.align],
    s.fontSize && FONT[s.fontSize],
    hasBorder && BORDER_W[s.borderWidth!],
    hasBorder && BORDER_C[s.borderColor ?? "border"],
    s.width && WIDTH[s.width],
    s.width && s.width !== "auto" && s.width !== "full" && JUSTIFY[s.justify ?? "left"],
  ]
    .filter(Boolean)
    .join(" ");
}

/** Há algum estilo visual que justifique embrulhar o bloco numa <div>? */
export function hasStyles(s: BlockStyles | undefined): boolean {
  return !!s && styleClass(s).length > 0;
}
