import type { Block } from "./schema";

/**
 * Área de transferência de BLOCOS entre artigos. Vive no `localStorage` (não na
 * área de transferência do SO) para sobreviver à navegação de um artigo para
 * outro — é isso que permite copiar/recortar aqui e colar lá, íntegro. Guarda os
 * blocos de topo selecionados, cada um com toda a sua subárvore.
 */
const KEY = "kb.blockClipboard";

export function copyBlocksToClipboard(blocks: Block[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, blocks }));
    return true;
  } catch {
    return false;
  }
}

export function readBlocksFromClipboard(): Block[] | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { blocks?: unknown };
    return Array.isArray(parsed.blocks) && parsed.blocks.length ? (parsed.blocks as Block[]) : null;
  } catch {
    return null;
  }
}
