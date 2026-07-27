import type { CSSProperties, PointerEvent as RPointerEvent, MouseEvent as RMouseEvent, Ref } from "react";
import type { FlowData, FlowNodeType, FlowIconPos } from "@/lib/blocks/schema";
import { layoutFlow, edgePath, type PlacedNode } from "@/lib/blocks/flow-layout";
import { ICONS } from "@/lib/blocks/icons";

/**
 * Fluxograma (SVG). Componente PURO (sem hooks) → serve o portal (server, só
 * leitura) E o editor: passando `interactive`, os nós ficam arrastáveis e nós/
 * arestas abrem menu de contexto. Honra estilos por nó (cor/borda/fonte/ícone) e
 * por aresta (formato/cor/espessura/setas).
 */

export type FlowSelection = { kind: "node" | "edge"; id: string } | null;
export type FlowInteractive = {
  svgRef?: Ref<SVGSVGElement>;
  onNodePointerDown?: (id: string, e: RPointerEvent) => void;
  onNodeContextMenu?: (id: string, e: RMouseEvent) => void;
  onEdgeContextMenu?: (id: string, e: RMouseEvent) => void;
  selected?: FlowSelection;
  /** Fator de zoom (largura do SVG = largura do layout × zoom). */
  zoom?: number;
};

type Estilo = { fill: string; stroke: string; text: string };
const ESTILO: Record<FlowNodeType, Estilo> = {
  start: { fill: "var(--color-primary)", stroke: "var(--color-primary)", text: "#ffffff" },
  end: { fill: "#2C1A63", stroke: "#2C1A63", text: "#ffffff" },
  process: { fill: "var(--color-surface)", stroke: "var(--color-border-strong)", text: "var(--color-text)" },
  decision: { fill: "var(--color-surface)", stroke: "#C95788", text: "var(--color-text)" },
  io: { fill: "var(--color-surface)", stroke: "#2563EB", text: "var(--color-text)" },
  subroutine: { fill: "var(--color-surface)", stroke: "var(--color-border-strong)", text: "var(--color-text)" },
};

function Forma({
  p,
  fill,
  stroke,
  strokeWidth,
}: {
  p: PlacedNode;
  fill: string;
  stroke: string;
  strokeWidth: number;
}) {
  const { w, h } = p;
  const c = { fill, stroke, strokeWidth, filter: "url(#fx-sombra)" };
  switch (p.node.type) {
    case "start":
    case "end":
      return <rect width={w} height={h} rx={h / 2} ry={h / 2} {...c} />;
    case "decision":
      return <polygon points={`${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`} {...c} />;
    case "io":
      return <polygon points={`16,0 ${w},0 ${w - 16},${h} 0,${h}`} {...c} />;
    case "subroutine":
      return (
        <>
          <rect width={w} height={h} rx={10} {...c} />
          <line x1={8} y1={0} x2={8} y2={h} stroke={stroke} strokeWidth={1} />
          <line x1={w - 8} y1={0} x2={w - 8} y2={h} stroke={stroke} strokeWidth={1} />
        </>
      );
    default:
      return <rect width={w} height={h} rx={12} {...c} />;
  }
}

const FLEX: Record<FlowIconPos, CSSProperties> = {
  top: { flexDirection: "column" },
  bottom: { flexDirection: "column-reverse" },
  left: { flexDirection: "row" },
  right: { flexDirection: "row-reverse" },
};

function Arrow({
  x,
  y,
  fromX,
  fromY,
  size,
  color,
}: {
  x: number;
  y: number;
  fromX: number;
  fromY: number;
  size: number;
  color: string;
}) {
  const ang = Math.atan2(y - fromY, x - fromX);
  const a1 = ang + Math.PI - 0.42;
  const a2 = ang + Math.PI + 0.42;
  // ARREDONDA: Math.cos/sin/atan2 não são bit-idênticos entre Node (SSR) e o
  // navegador → sem arredondar, as coordenadas divergem e o React acusa
  // hydration mismatch neste polígono.
  const rr = (n: number) => Math.round(n * 100) / 100;
  return (
    <polygon
      points={`${rr(x)},${rr(y)} ${rr(x + size * Math.cos(a1))},${rr(y + size * Math.sin(a1))} ${rr(x + size * Math.cos(a2))},${rr(y + size * Math.sin(a2))}`}
      fill={color}
    />
  );
}

export function FlowView({ data, interactive }: { data: FlowData; interactive?: FlowInteractive }) {
  const layout = layoutFlow(data);
  if (!layout.nodes.length) {
    return (
      <div className="not-prose my-6 flex h-[160px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-text-muted">
        Fluxograma vazio — descreva os passos ou use “Editar com IA”.
      </div>
    );
  }
  const PAD = 20;
  const W = layout.width + PAD * 2;
  const H = layout.height + PAD * 2;
  const sel = interactive?.selected ?? null;
  const zoom = interactive?.zoom ?? null;
  const larguraZoom = zoom != null ? Math.round(W * zoom) : null;

  return (
    <figure className="not-prose my-6 overflow-x-auto">
      <svg
        ref={interactive?.svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width={larguraZoom ?? (interactive ? undefined : Math.min(W, 720))}
        style={{
          width: larguraZoom ?? (interactive ? "100%" : undefined),
          maxWidth: larguraZoom != null ? "none" : "100%",
          height: "auto",
          margin: "0 auto",
          display: "block",
          touchAction: interactive ? "none" : undefined,
        }}
        role="img"
        aria-label="Fluxograma"
      >
        <defs>
          <filter id="fx-sombra" x="-20%" y="-20%" width="140%" height="160%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="2.5" floodColor="#0f172a" floodOpacity="0.10" />
          </filter>
        </defs>
        <g transform={`translate(${PAD},${PAD})`}>
          {layout.edges.map((e) => {
            const st = e.edge.style ?? {};
            const color = st.color || "var(--color-border-strong)";
            const width = st.width ?? 1.5;
            const shape = st.shape ?? "bezier";
            const arrows = st.arrows ?? "end";
            const asize = st.arrowSize ?? 9;
            const d = edgePath(e.x1, e.y1, e.x2, e.y2, shape);
            const selecionada = sel?.kind === "edge" && sel.id === e.edge.id;
            return (
              <g key={e.edge.id}>
                <path
                  d={d}
                  fill="none"
                  stroke={selecionada ? "var(--color-primary)" : color}
                  strokeWidth={width}
                />
                {(arrows === "end" || arrows === "both") && (
                  <Arrow x={e.x2} y={e.y2} fromX={e.x1} fromY={e.y1} size={asize} color={color} />
                )}
                {arrows === "both" && (
                  <Arrow x={e.x1} y={e.y1} fromX={e.x2} fromY={e.y2} size={asize} color={color} />
                )}
                {e.edge.label ? <ChipRotulo x={e.lx} y={e.ly} label={e.edge.label} /> : null}
                {interactive && (
                  <path
                    d={d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={Math.max(14, width + 12)}
                    style={{ cursor: "context-menu" }}
                    onContextMenu={(ev) => {
                      ev.preventDefault();
                      interactive.onEdgeContextMenu?.(e.edge.id, ev);
                    }}
                  />
                )}
              </g>
            );
          })}
          {layout.nodes.map((p) => {
            const ns = p.node.style ?? {};
            const base = ESTILO[p.node.type];
            const selecionado = sel?.kind === "node" && sel.id === p.node.id;
            const Icon = ns.icon && !ns.iconImage ? ICONS[ns.icon] : null;
            const pos = ns.iconPos ?? "left";
            const temIcone = !!(ns.iconImage || Icon);
            return (
              <g
                key={p.node.id}
                transform={`translate(${p.x},${p.y})`}
                onPointerDown={interactive ? (ev) => interactive.onNodePointerDown?.(p.node.id, ev) : undefined}
                onContextMenu={
                  interactive
                    ? (ev) => {
                        ev.preventDefault();
                        interactive.onNodeContextMenu?.(p.node.id, ev);
                      }
                    : undefined
                }
                style={interactive ? { cursor: "grab" } : undefined}
              >
                {selecionado && (
                  <rect
                    x={-4}
                    y={-4}
                    width={p.w + 8}
                    height={p.h + 8}
                    rx={14}
                    fill="none"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    strokeDasharray="5 3"
                  />
                )}
                <Forma
                  p={p}
                  fill={ns.bg || base.fill}
                  stroke={ns.borderColor || base.stroke}
                  strokeWidth={ns.borderWidth ?? 1.5}
                />
                <foreignObject width={p.w} height={p.h}>
                  <div
                    style={{
                      width: p.w,
                      height: p.h,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 5,
                      ...(temIcone ? FLEX[pos] : null),
                      textAlign: "center",
                      padding: "0 10px",
                      fontSize: 12.5,
                      lineHeight: 1.2,
                      fontWeight: ns.bold ? 700 : 500,
                      fontStyle: ns.italic ? "italic" : "normal",
                      color: ns.fontColor || base.text,
                      overflow: "hidden",
                    }}
                  >
                    {ns.iconImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={ns.iconImage} alt="" style={{ width: 18, height: 18, objectFit: "contain" }} />
                    ) : Icon ? (
                      <Icon style={{ width: 16, height: 16, flexShrink: 0 }} />
                    ) : null}
                    <span style={{ minWidth: 0, overflow: "hidden" }}>{p.node.label}</span>
                  </div>
                </foreignObject>
              </g>
            );
          })}
        </g>
      </svg>
    </figure>
  );
}

function ChipRotulo({ x, y, label }: { x: number; y: number; label: string }) {
  const w = Math.max(24, label.length * 6.5 + 12);
  const h = 18;
  return (
    <g transform={`translate(${x - w / 2},${y - h / 2})`}>
      <rect width={w} height={h} rx={9} fill="var(--color-surface)" stroke="var(--color-border)" strokeWidth={1} />
      <foreignObject width={w} height={h}>
        <div
          style={{
            width: w,
            height: h,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10.5,
            fontWeight: 600,
            color: "var(--color-text-muted)",
          }}
        >
          {label}
        </div>
      </foreignObject>
    </g>
  );
}
