import type { TableColor } from "./schema";

/**
 * Classe de fundo por cor de célula. O `!` (importante) vence a zebra do portal
 * (`.table-portal tbody tr:nth-child(even) td` tem especificidade maior que uma
 * utilitária simples). A MESMA classe serve para o portal e para o editor.
 */
export const TABLE_CELL_BG: Record<TableColor, string> = {
  purple: "!bg-brand-purple-50 dark:!bg-brand-purple-950/40",
  pink: "!bg-brand-pink-50 dark:!bg-brand-pink-950/40",
  blue: "!bg-info-soft dark:!bg-info-soft",
  green: "!bg-success-soft dark:!bg-success-soft",
  amber: "!bg-warning-soft dark:!bg-warning-soft",
  gray: "!bg-surface-2",
};

/** Amostra de cor (swatch) dos botões no editor. */
export const TABLE_CELL_SWATCH: Record<TableColor, string> = {
  purple: "bg-brand-purple-300 dark:bg-brand-purple-700",
  pink: "bg-brand-pink-300 dark:bg-brand-pink-700",
  blue: "bg-info",
  green: "bg-success",
  amber: "bg-warning",
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
