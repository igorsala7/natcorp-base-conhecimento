import type { TableColor } from "./schema";

/**
 * Classe de fundo por cor de célula. O `!` (importante) vence a zebra do portal
 * (`.table-portal tbody tr:nth-child(even) td` tem especificidade maior que uma
 * utilitária simples). A MESMA classe serve para o portal e para o editor.
 */
export const TABLE_CELL_BG: Record<TableColor, string> = {
  purple: "!bg-brand-purple-50 dark:!bg-brand-purple-950/40",
  pink: "!bg-brand-pink-50 dark:!bg-brand-pink-950/40",
  blue: "!bg-sky-50 dark:!bg-sky-950/40",
  green: "!bg-emerald-50 dark:!bg-emerald-950/40",
  amber: "!bg-amber-50 dark:!bg-amber-950/40",
  gray: "!bg-surface-2",
};

/** Amostra de cor (swatch) dos botões no editor. */
export const TABLE_CELL_SWATCH: Record<TableColor, string> = {
  purple: "bg-brand-purple-300 dark:bg-brand-purple-700",
  pink: "bg-brand-pink-300 dark:bg-brand-pink-700",
  blue: "bg-sky-300 dark:bg-sky-700",
  green: "bg-emerald-300 dark:bg-emerald-700",
  amber: "bg-amber-300 dark:bg-amber-700",
  gray: "bg-brand-gray-400",
};

export const TABLE_COLORS: TableColor[] = ["purple", "pink", "blue", "green", "amber", "gray"];

export const TABLE_COLOR_LABEL: Record<TableColor, string> = {
  purple: "Roxo",
  pink: "Rosa",
  blue: "Azul",
  green: "Verde",
  amber: "Âmbar",
  gray: "Cinza",
};

/** Classe da cor da célula (r,c) a partir da matriz `cellColors`. */
export function cellBgClass(
  cellColors: (TableColor | null)[][] | undefined,
  r: number,
  c: number,
): string {
  const color = cellColors?.[r]?.[c] ?? null;
  return color ? TABLE_CELL_BG[color] : "";
}
