import type { MindMapData, MindMapNode } from "./schema";

/**
 * Layout automático do mapa mental (LR: raiz à esquerda, filhos abrindo para a
 * direita). Puro e determinístico — recebe o conjunto de nós RETRAÍDOS (estado
 * de runtime do leitor) e devolve as posições; a view recalcula ao expandir/
 * retrair. Um nó retraído é tratado como folha (filhos não entram no layout).
 *
 * SEM SOBREPOSIÇÃO: cada NÍVEL ocupa uma coluna com a largura do SEU nó mais
 * largo (+ folga), então um rótulo comprido nunca invade a coluna seguinte.
 */
export const MM_NODE_H = 34;
const ROW_H = 46; // altura da linha (nó + respiro vertical)
const COL_GAP = 44; // folga horizontal entre uma coluna e a próxima
const PAD = 16;

/** Largura do nó pelo tamanho do rótulo + ícone/link/nota (limitada). */
export function mmNodeWidth(node: MindMapNode): number {
  const base = Math.max(96, Math.min(230, (node.label || "").length * 7.4 + 30));
  return base + (node.icon ? 20 : 0) + (node.link ? 14 : 0) + (node.note ? 10 : 0);
}

export type MMPlacedNode = {
  id: string;
  node: MindMapNode;
  depth: number;
  x: number;
  y: number; // canto superior-esquerdo
  w: number;
  h: number;
  hasChildren: boolean;
  collapsed: boolean;
};
export type MMEdge = { from: string; to: string; x1: number; y1: number; x2: number; y2: number };
export type MMLayout = { nodes: MMPlacedNode[]; edges: MMEdge[]; width: number; height: number };

export function layoutMindMap(data: MindMapData, collapsed: ReadonlySet<string>): MMLayout {
  type Tmp = { node: MindMapNode; depth: number; w: number; cy: number };
  const tmp: Tmp[] = [];
  const maxW: number[] = []; // maior largura por nível
  let cursorY = PAD;

  /** Coloca a subárvore (só Y) e devolve o Y do CENTRO deste nó. */
  function walk(node: MindMapNode, depth: number): number {
    const kids = !collapsed.has(node.id) ? node.children ?? [] : [];
    let cy: number;
    if (kids.length === 0) {
      cy = cursorY + MM_NODE_H / 2;
      cursorY += ROW_H;
    } else {
      const centros = kids.map((k) => walk(k, depth + 1));
      cy = (centros[0]! + centros[centros.length - 1]!) / 2;
    }
    const w = mmNodeWidth(node);
    maxW[depth] = Math.max(maxW[depth] ?? 0, w);
    tmp.push({ node, depth, w, cy });
    return cy;
  }
  walk(data.root, 0);

  // X de cada coluna = soma das larguras (máx.) das colunas anteriores + folga.
  const colX: number[] = [PAD];
  for (let d = 1; d < maxW.length; d++) colX[d] = colX[d - 1]! + (maxW[d - 1] ?? 0) + COL_GAP;

  let maxX = 0;
  let maxY = 0;
  const nodes: MMPlacedNode[] = tmp.map((t) => {
    const x = colX[t.depth]!;
    const y = t.cy - MM_NODE_H / 2;
    maxX = Math.max(maxX, x + t.w);
    maxY = Math.max(maxY, y + MM_NODE_H);
    return {
      id: t.node.id,
      node: t.node,
      depth: t.depth,
      x,
      y,
      w: t.w,
      h: MM_NODE_H,
      hasChildren: !!t.node.children?.length,
      collapsed: collapsed.has(t.node.id),
    };
  });

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges: MMEdge[] = [];
  for (const p of nodes) {
    if (p.collapsed) continue;
    for (const k of p.node.children ?? []) {
      const cp = byId.get(k.id);
      if (cp) edges.push({ from: p.id, to: k.id, x1: p.x + p.w, y1: p.y + p.h / 2, x2: cp.x, y2: cp.y + cp.h / 2 });
    }
  }
  return { nodes, edges, width: maxX + PAD, height: maxY + PAD };
}

/** IDs que começam retraídos (flag `collapsed` na árvore) — usado no EDITOR. */
export function initialCollapsed(root: MindMapNode): Set<string> {
  const set = new Set<string>();
  const walk = (n: MindMapNode) => {
    if (n.collapsed && n.children?.length) set.add(n.id);
    n.children?.forEach(walk);
  };
  walk(root);
  return set;
}

/**
 * Estado inicial do LEITOR: só a RAIZ expandida — todo nó com filhos abaixo dela
 * começa retraído. Assim a visão abre limpa (raiz + ramos de 1º nível) e o
 * leitor expande o que quiser.
 */
export function collapsedAllButRoot(root: MindMapNode): Set<string> {
  const set = new Set<string>();
  const walk = (n: MindMapNode, depth: number) => {
    if (depth > 0 && n.children?.length) set.add(n.id);
    n.children?.forEach((c) => walk(c, depth + 1));
  };
  walk(root, 0);
  return set;
}
