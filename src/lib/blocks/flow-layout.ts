/**
 * Layout do fluxograma. Camadas topo→baixo por padrão; nós ARRASTADOS (com x,y
 * no dado) ficam FIXOS e os demais seguem no automático. PURO e determinístico
 * (sem DOM) → roda no servidor (portal) e no cliente (editor).
 */
import type { FlowData, FlowNode, FlowEdge, FlowEdgeShape } from "./schema";

export type PlacedNode = { node: FlowNode; x: number; y: number; w: number; h: number };
export type PlacedEdge = {
  edge: FlowEdge;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  lx: number;
  ly: number;
};
export type FlowLayout = { nodes: PlacedNode[]; edges: PlacedEdge[]; width: number; height: number };

const CHAR_W = 7.1;
const PAD_X = 26;
const ROW_GAP = 54;
const COL_GAP = 40;

export function sizeOf(n: FlowNode): { w: number; h: number } {
  const s = n.style ?? {};
  const temIcone = !!(s.icon || s.iconImage);
  const pos = s.iconPos ?? "left";
  const iconLado = temIcone && (pos === "left" || pos === "right");
  const iconCima = temIcone && (pos === "top" || pos === "bottom");
  const textoW = n.label.length * CHAR_W * (s.bold ? 1.06 : 1);
  const extraLado = iconLado ? 26 : 0;

  let w = Math.max(112, Math.min(340, textoW + PAD_X * 2 + extraLado));
  if (n.type === "start" || n.type === "end") w = Math.max(96, textoW + 44 + extraLado);
  if (n.type === "decision") w = Math.max(150, w);

  // Altura cresce com o texto QUEBRADO (N linhas) e com o ícone em cima/abaixo,
  // para o item se adequar ao conteúdo interno.
  const util = Math.max(40, w - PAD_X * 2 - extraLado);
  const linhas = Math.max(1, Math.ceil(textoW / util));
  let h = 30 + linhas * 18 + (iconCima ? 22 : 0);
  if (n.type === "decision") h = Math.max(h, 66);
  if (n.type === "start" || n.type === "end") h = Math.max(44, h);
  return { w: Math.round(w), h: Math.round(h) };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Ponto na BORDA do retângulo do nó, na direção de (tx,ty). */
function borderPoint(p: PlacedNode, tx: number, ty: number): { x: number; y: number } {
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const sx = dx !== 0 ? p.w / 2 / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? p.h / 2 / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return { x: cx + dx * s, y: cy + dy * s };
}

/** `d` do conector conforme o formato (flexível/reto/cotovelo/arco). */
export function edgePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  shape: FlowEdgeShape = "bezier",
): string {
  switch (shape) {
    case "straight":
      return `M ${x1} ${y1} L ${x2} ${y2}`;
    case "step": {
      const my = (y1 + y2) / 2;
      return `M ${x1} ${y1} L ${x1} ${r1(my)} L ${x2} ${r1(my)} L ${x2} ${y2}`;
    }
    case "arc": {
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const len = Math.hypot(x2 - x1, y2 - y1) || 1;
      const off = len * 0.22;
      const nx = -(y2 - y1) / len;
      const ny = (x2 - x1) / len;
      return `M ${x1} ${y1} Q ${r1(mx + nx * off)} ${r1(my + ny * off)} ${x2} ${y2}`;
    }
    default: {
      const my = (y1 + y2) / 2;
      return `M ${x1} ${y1} C ${x1} ${r1(my)}, ${x2} ${r1(my)}, ${x2} ${y2}`;
    }
  }
}

export function layoutFlow(data: FlowData): FlowLayout {
  const nodes = data.nodes ?? [];
  const edges = (data.edges ?? []).filter((e) => e.from !== e.to);
  if (!nodes.length) return { nodes: [], edges: [], width: 0, height: 0 };

  const outgoing = new Map<string, string[]>();
  for (const n of nodes) outgoing.set(n.id, []);
  for (const e of edges) outgoing.get(e.from)?.push(e.to);

  // Arestas de RETORNO (loops) detectadas por DFS e ignoradas no ranking.
  const retorno = new Set<string>();
  const cor = new Map<string, 0 | 1 | 2>();
  const dfs = (id: string) => {
    cor.set(id, 1);
    for (const to of outgoing.get(id) ?? []) {
      const c = cor.get(to) ?? 0;
      if (c === 1) retorno.add(`${id}>${to}`);
      else if (c === 0) dfs(to);
    }
    cor.set(id, 2);
  };
  for (const n of nodes) if ((cor.get(n.id) ?? 0) === 0) dfs(n.id);

  const entradaFwd = new Map<string, string[]>();
  for (const n of nodes) entradaFwd.set(n.id, []);
  for (const e of edges) if (!retorno.has(`${e.from}>${e.to}`)) entradaFwd.get(e.to)?.push(e.from);
  const rank = new Map<string, number>();
  const rankDe = (id: string): number => {
    const j = rank.get(id);
    if (j != null) return j;
    const ins = entradaFwd.get(id) ?? [];
    const r = ins.length ? Math.max(...ins.map((p) => rankDe(p) + 1)) : 0;
    rank.set(id, r);
    return r;
  };
  for (const n of nodes) rankDe(n.id);

  const porRank = new Map<number, FlowNode[]>();
  for (const n of nodes) {
    const r = rank.get(n.id) ?? 0;
    if (!porRank.has(r)) porRank.set(r, []);
    porRank.get(r)!.push(n);
  }
  const ranks = [...porRank.keys()].sort((a, b) => a - b);
  const linhas = ranks.map((r) => {
    const ns = porRank.get(r)!;
    const sizes = ns.map(sizeOf);
    const w = sizes.reduce((s, z) => s + z.w, 0) + COL_GAP * (ns.length - 1);
    const h = Math.max(...sizes.map((z) => z.h));
    return { ns, sizes, w, h };
  });
  const largura = Math.max(1, ...linhas.map((l) => l.w));
  const centro = largura / 2;

  const placed = new Map<string, PlacedNode>();
  let y = 0;
  for (const l of linhas) {
    let x = centro - l.w / 2;
    l.ns.forEach((n, i) => {
      const sz = l.sizes[i]!;
      placed.set(n.id, { node: n, x, y: y + (l.h - sz.h) / 2, w: sz.w, h: sz.h });
      x += sz.w + COL_GAP;
    });
    y += l.h + ROW_GAP;
  }
  const height0 = Math.max(1, y - ROW_GAP);

  // Fixa os nós ARRASTADOS (x,y no dado); os demais seguem no automático.
  for (const p of placed.values()) {
    if (typeof p.node.x === "number" && typeof p.node.y === "number") {
      p.x = p.node.x;
      p.y = p.node.y;
    }
  }
  // Normaliza para (0,0) — arrastar pode gerar coordenadas negativas.
  const all = [...placed.values()];
  const minX = Math.min(0, ...all.map((p) => p.x));
  const minY = Math.min(0, ...all.map((p) => p.y));
  if (minX !== 0 || minY !== 0) for (const p of all) {
    p.x -= minX;
    p.y -= minY;
  }
  const width = Math.max(largura, ...all.map((p) => p.x + p.w));
  const height = Math.max(height0, ...all.map((p) => p.y + p.h));

  const pe: PlacedEdge[] = [];
  for (const e of edges) {
    const a = placed.get(e.from);
    const b = placed.get(e.to);
    if (!a || !b) continue;
    const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
    const bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    const p1 = borderPoint(a, bc.x, bc.y);
    const p2 = borderPoint(b, ac.x, ac.y);
    pe.push({
      edge: e,
      x1: r1(p1.x),
      y1: r1(p1.y),
      x2: r1(p2.x),
      y2: r1(p2.y),
      lx: (p1.x + p2.x) / 2,
      ly: (p1.y + p2.y) / 2,
    });
  }

  return { nodes: all, edges: pe, width, height };
}
