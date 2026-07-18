import type { TreeNode } from "@/lib/content/tree";

export type FlatItem = {
  id: string;
  parentId: string | null;
  depth: number;
  node: TreeNode;
  collapsed: boolean;
};

/** Achata a árvore em lista (respeitando nós colapsados). */
export function flatten(
  nodes: TreeNode[],
  collapsedIds: Set<string>,
  parentId: string | null = null,
  depth = 0,
): FlatItem[] {
  return nodes.flatMap((node) => {
    const collapsed = collapsedIds.has(node.id);
    const self: FlatItem = { id: node.id, parentId, depth, node, collapsed };
    if (collapsed || node.children.length === 0) return [self];
    return [self, ...flatten(node.children, collapsedIds, node.id, depth + 1)];
  });
}

function getMaxDepth(prev?: FlatItem) {
  return prev ? prev.depth + 1 : 0;
}
function getMinDepth(next?: FlatItem) {
  return next ? next.depth : 0;
}

/**
 * Projeta parent/depth do item arrastado a partir do deslocamento horizontal.
 * Baseado no exemplo de árvore ordenável do dnd-kit.
 */
export function getProjection(
  items: FlatItem[],
  activeId: string,
  overId: string,
  dragOffset: number,
  indentationWidth: number,
) {
  const overIndex = items.findIndex((i) => i.id === overId);
  const activeIndex = items.findIndex((i) => i.id === activeId);
  const activeItem = items[activeIndex];
  const newItems = arrayMove(items, activeIndex, overIndex);
  const prev = newItems[overIndex - 1];
  const next = newItems[overIndex + 1];

  const dragDepth = Math.round(dragOffset / indentationWidth);
  const projectedDepth = (activeItem?.depth ?? 0) + dragDepth;
  const maxDepth = getMaxDepth(prev);
  const minDepth = getMinDepth(next);
  let depth = projectedDepth;
  if (depth > maxDepth) depth = maxDepth;
  if (depth < minDepth) depth = minDepth;

  function getParentId(): string | null {
    if (depth === 0 || !prev) return null;
    if (depth === prev.depth) return prev.parentId;
    if (depth > prev.depth) return prev.id;
    const parent = newItems
      .slice(0, overIndex)
      .reverse()
      .find((i) => i.depth === depth)?.parentId;
    return parent ?? null;
  }

  return { depth, parentId: getParentId(), overIndex };
}

export function arrayMove<T>(array: T[], from: number, to: number): T[] {
  const copy = array.slice();
  const [item] = copy.splice(from, 1);
  if (item !== undefined) copy.splice(to, 0, item);
  return copy;
}

/**
 * Vizinhos (positions) do item ao ser solto sob parentId, na posição overIndex
 * da lista achatada — para calcular o índice fracionário.
 */
export function siblingPositions(
  items: FlatItem[],
  parentId: string | null,
  activeId: string,
  targetIndex: number,
): { prev: string | null; next: string | null } {
  // Irmãos (mesmo parent), na ordem atual da lista achatada, sem o ativo.
  const siblings = items.filter(
    (i) => i.parentId === parentId && i.id !== activeId,
  );
  // Descobre quantos irmãos vêm antes do targetIndex na lista achatada.
  const before = items
    .slice(0, targetIndex)
    .filter((i) => i.parentId === parentId && i.id !== activeId).length;
  const prev = siblings[before - 1]?.node.position ?? null;
  const next = siblings[before]?.node.position ?? null;
  return { prev, next };
}
