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

/**
 * Modelo de drop INTUITIVO (estilo gerenciador de arquivos): a posição do
 * cursor DENTRO da linha-alvo decide a ação — sem depender de arrasto lateral.
 *   - `before` / `after`: vira IRMÃO do item-alvo (linha acima/abaixo, no nível
 *     do próprio alvo);
 *   - `inside`: vira FILHO do item-alvo (só pasta) — a pasta inteira destaca.
 */
export type DropZone = "before" | "after" | "inside";

export type PlanoDeDrop = {
  /** Árvore já reordenada (reordenação OTIMISTA — o item fica onde caiu). */
  tree: TreeNode[];
  /** Novo pai (null = raiz). */
  parentId: string | null;
  /** Positions dos vizinhos para o índice fracionário do servidor. */
  prev: string | null;
  next: string | null;
};

/** Remove um nó (com subárvore) da árvore; devolve a árvore nova e o removido. */
function removerNo(nodes: TreeNode[], id: string): { tree: TreeNode[]; removido: TreeNode | null } {
  let removido: TreeNode | null = null;
  const anda = (list: TreeNode[]): TreeNode[] =>
    list
      .filter((n) => {
        if (n.id === id) {
          removido = n;
          return false;
        }
        return true;
      })
      .map((n) => ({ ...n, children: anda(n.children) }));
  return { tree: anda(nodes), removido };
}

/** Localiza o item-alvo: seu array de irmãos, índice, pai e o próprio nó. */
function localizar(
  list: TreeNode[],
  id: string,
  parentId: string | null,
): { siblings: TreeNode[]; index: number; parentId: string | null; node: TreeNode } | null {
  const index = list.findIndex((n) => n.id === id);
  if (index >= 0) return { siblings: list, index, parentId, node: list[index]! };
  for (const n of list) {
    const achado = localizar(n.children, id, n.id);
    if (achado) return achado;
  }
  return null;
}

/**
 * Planeja o drop: onde o item entra (pai + vizinhos para position) e a árvore
 * já reordenada (otimista). `null` se o drop for inválido (no próprio item ou
 * dentro da própria subárvore). PURA e testável.
 */
export function planejarDrop(
  nodes: TreeNode[],
  activeId: string,
  overId: string,
  zone: DropZone,
): PlanoDeDrop | null {
  if (activeId === overId) return null;
  const { tree: semAtivo, removido } = removerNo(nodes, activeId);
  if (!removido) return null;
  const alvo = localizar(semAtivo, overId, null);
  if (!alvo) return null; // overId estava dentro da subárvore do ativo → inválido

  let parentId: string | null;
  let container: TreeNode[];
  let insertIdx: number;
  let prevNode: TreeNode | undefined;
  let nextNode: TreeNode | undefined;

  if (zone === "inside") {
    parentId = alvo.node.id;
    container = alvo.node.children;
    insertIdx = 0; // entra como PRIMEIRO filho (fica visível ao expandir)
    nextNode = alvo.node.children[0];
  } else {
    parentId = alvo.parentId;
    container = alvo.siblings;
    if (zone === "before") {
      insertIdx = alvo.index;
      prevNode = alvo.siblings[alvo.index - 1];
      nextNode = alvo.node;
    } else {
      insertIdx = alvo.index + 1;
      prevNode = alvo.node;
      nextNode = alvo.siblings[alvo.index + 1];
    }
  }

  // Insere `removido` no `container` (comparação por REFERÊNCIA dentro de semAtivo).
  const inserir = (list: TreeNode[]): TreeNode[] => {
    if (list === container) {
      const copia = list.slice();
      copia.splice(insertIdx, 0, removido!);
      return copia;
    }
    return list.map((n) => ({ ...n, children: inserir(n.children) }));
  };

  return {
    tree: inserir(semAtivo),
    parentId,
    prev: prevNode?.position ?? null,
    next: nextNode?.position ?? null,
  };
}
