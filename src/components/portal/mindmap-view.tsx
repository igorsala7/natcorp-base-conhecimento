"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as RPointerEvent,
  type ReactNode,
  type WheelEvent,
} from "react";
import { ExternalLink, Maximize2, Minus, Plus, RotateCcw, X } from "lucide-react";
import type { MindMapData } from "@/lib/blocks/schema";
import { ICONS } from "@/lib/blocks/icons";
import { layoutMindMap, initialCollapsed, collapsedAllButRoot } from "@/lib/blocks/mindmap-layout";

/** Edição opcional (só no editor do bloco): selecionar um nó para estilizar. */
export type MindMapEdit = {
  selectedId: string | null;
  onSelect: (id: string) => void;
};

/**
 * Mapa mental INTERATIVO (leitor e editor): clicar num nó com filhos expande/
 * retrai; a barra dá zoom (+/−/redefinir) e TELA CHEIA (fundo sólido); arrastar
 * o fundo faz o pan; Ctrl/⌘ + roda também dá zoom. Cada nó pode ter ícone, cor,
 * preenchimento, nota (tooltip) e link. Layout automático (mindmap-layout.ts).
 */
export function MindMapView({
  data,
  edit,
  panel,
}: {
  data: MindMapData;
  edit?: MindMapEdit;
  /** Painel de personalização (só no editor) — mostrado abaixo do mapa e, em
   *  TELA CHEIA, como barra lateral, para editar sem sair do modo maximizado. */
  panel?: ReactNode;
}) {
  // Leitor: abre com só a RAIZ expandida (resto retraído). Editor: respeita as
  // flags `collapsed` (o autor precisa ver a árvore para editar).
  const [collapsed, setCollapsed] = useState<Set<string>>(() =>
    edit ? initialCollapsed(data.root) : collapsedAllButRoot(data.root),
  );
  const [full, setFull] = useState(false);
  return (
    <>
      <Canvas data={data} collapsed={collapsed} setCollapsed={setCollapsed} edit={edit} onMaximize={() => setFull(true)} />
      {!full && panel && <div className="mt-2">{panel}</div>}
      {full && (
        <div className="fixed inset-0 z-[200] flex flex-col bg-surface">
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <span className="truncate text-sm font-semibold text-primary">{data.root.label || "Mapa mental"}</span>
            <button
              type="button"
              onClick={() => setFull(false)}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-sm text-text-muted hover:border-primary hover:text-primary"
            >
              <X className="size-4" /> Fechar
            </button>
          </div>
          <div className="flex min-h-0 flex-1">
            <div className="min-w-0 flex-1">
              <Canvas data={data} collapsed={collapsed} setCollapsed={setCollapsed} edit={edit} fill />
            </div>
            {panel && (
              <aside className="w-72 shrink-0 overflow-y-auto border-l border-border bg-surface p-3 md:w-80">
                {panel}
              </aside>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function IconBtn({ onClick, title, children }: { onClick: () => void; title: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="rounded p-1 text-text-muted transition-colors hover:bg-surface-2 hover:text-primary"
    >
      {children}
    </button>
  );
}

function Canvas({
  data,
  collapsed,
  setCollapsed,
  edit,
  onMaximize,
  fill,
}: {
  data: MindMapData;
  collapsed: Set<string>;
  setCollapsed: (fn: (prev: Set<string>) => Set<string>) => void;
  edit?: MindMapEdit;
  onMaximize?: () => void;
  fill?: boolean;
}) {
  const lay = useMemo(() => layoutMindMap(data, collapsed), [data, collapsed]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 12, y: 12 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const centralizado = useRef(false);

  // Centraliza a RAIZ no canvas uma vez, quando o container já tem tamanho.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || centralizado.current) return;
    const raiz = lay.nodes.find((n) => n.depth === 0);
    const posicionar = () => {
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      if (!cw || !ch || !raiz) return false;
      setPan({ x: cw / 2 - (raiz.x + raiz.w / 2) * zoom, y: ch / 2 - (raiz.y + raiz.h / 2) * zoom });
      centralizado.current = true;
      return true;
    };
    if (posicionar()) return;
    const ro = new ResizeObserver(() => {
      if (posicionar()) ro.disconnect();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [lay, zoom]);

  const toggle = (id: string, has: boolean) => {
    if (!has) return;
    setCollapsed((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const onDown = (e: RPointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-mm-node]")) return; // clicar num nó = alternar, não panar
    drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: RPointerEvent) => {
    if (!drag.current) return;
    setPan({ x: drag.current.px + (e.clientX - drag.current.x), y: drag.current.py + (e.clientY - drag.current.y) });
  };
  const onUp = () => {
    drag.current = null;
  };
  const onWheel = (e: WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return; // scroll normal da página fora do zoom
    e.preventDefault();
    setZoom((z) => clamp(z * (e.deltaY < 0 ? 1.12 : 0.89), 0.3, 2.6));
  };

  return (
    <div ref={wrapRef} className={`relative overflow-hidden rounded-lg border border-border bg-surface-1 ${fill ? "h-full" : "h-[360px]"}`}>
      <div className="absolute right-2 top-2 z-10 flex items-center gap-0.5 rounded-md border border-border bg-surface/90 p-0.5 shadow-1">
        <IconBtn onClick={() => setZoom((z) => clamp(z * 1.15, 0.3, 2.6))} title="Aproximar">
          <Plus className="size-4" />
        </IconBtn>
        <IconBtn onClick={() => setZoom((z) => clamp(z / 1.15, 0.3, 2.6))} title="Afastar">
          <Minus className="size-4" />
        </IconBtn>
        <IconBtn
          onClick={() => {
            setZoom(1);
            setPan({ x: 12, y: 12 });
          }}
          title="Redefinir zoom"
        >
          <RotateCcw className="size-4" />
        </IconBtn>
        {onMaximize && (
          <IconBtn onClick={onMaximize} title="Tela cheia">
            <Maximize2 className="size-4" />
          </IconBtn>
        )}
      </div>

      <div
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        onWheel={onWheel}
        style={{ touchAction: "none" }}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            width: lay.width,
            height: lay.height,
            position: "relative",
          }}
        >
          <svg
            width={lay.width}
            height={lay.height}
            className="pointer-events-none absolute inset-0 overflow-visible text-brand-gray-300 dark:text-brand-gray-600"
          >
            {lay.edges.map((e) => (
              <path
                key={`${e.from}-${e.to}`}
                d={`M${e.x1},${e.y1} C${e.x1 + 42},${e.y1} ${e.x2 - 42},${e.y2} ${e.x2},${e.y2}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
              />
            ))}
          </svg>
          {lay.nodes.map((n) => {
            const nd = n.node;
            const Icon = nd.icon ? ICONS[nd.icon] : undefined;
            const selecionado = edit?.selectedId === nd.id;
            return (
              <div
                key={n.id}
                data-mm-node="1"
                role="button"
                tabIndex={0}
                title={nd.note || nd.label}
                onClick={() => (edit ? edit.onSelect(nd.id) : toggle(n.id, n.hasChildren))}
                className={`absolute flex items-center gap-1 rounded-lg border px-2 text-left text-xs leading-tight shadow-1 transition-colors ${
                  n.depth === 0
                    ? "border-primary bg-brand-purple-50 font-semibold text-primary dark:bg-brand-purple-950/40"
                    : "border-border bg-surface text-text hover:border-primary"
                } ${selecionado ? "ring-2 ring-primary ring-offset-1" : ""} ${edit || n.hasChildren ? "cursor-pointer" : "cursor-default"}`}
                style={{
                  left: n.x,
                  top: n.y,
                  width: n.w,
                  height: n.h,
                  ...(nd.bg ? { backgroundColor: nd.bg } : {}),
                  ...(nd.color ? { borderColor: nd.color } : {}),
                }}
              >
                {n.hasChildren && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(n.id, true);
                    }}
                    aria-label={n.collapsed ? "Expandir" : "Retrair"}
                    className="shrink-0 text-2xs text-text-muted hover:text-primary"
                  >
                    {n.collapsed ? "▸" : "▾"}
                  </button>
                )}
                {Icon && (
                  <Icon className="size-3.5 shrink-0" style={nd.color ? { color: nd.color } : undefined} />
                )}
                <span className="truncate">{nd.label}</span>
                {nd.note && (
                  <span className="shrink-0 text-text-muted" aria-hidden>
                    •
                  </span>
                )}
                {nd.link && (
                  <a
                    href={nd.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Abrir link"
                    title={nd.link}
                    className="shrink-0 text-text-muted hover:text-primary"
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
