"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Trash2, Upload, ZoomIn, ZoomOut, Maximize2, Minimize2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import type {
  Block,
  FlowData,
  FlowNode,
  FlowEdge,
  FlowNodeType,
  FlowIconPos,
  FlowEdgeShape,
  FlowArrows,
} from "@/lib/blocks/schema";
import { FLOW_NODE_LABEL } from "@/lib/blocks/schema";
import { layoutFlow } from "@/lib/blocks/flow-layout";
import { FlowView, type FlowSelection } from "@/components/portal/flow-view";
import { uploadToAssets } from "@/lib/content/upload";
import { IconPicker } from "../icon-picker";
import type { BlockEditProps } from "../edit-types";
import { Select } from "@/components/ui/select";

type FlowBlockT = Extract<Block, { type: "flow" }>;
type Menu = { kind: "node" | "edge"; id: string; x: number; y: number };

/**
 * Canvas INTERATIVO do fluxograma (editor): arrastar nós (fixa a posição), e
 * botão-direito no nó/aresta abre menu para estilizar. Reusa o `FlowView` com
 * `interactive`. O layout automático segue valendo para os nós NÃO arrastados;
 * "Reorganizar" limpa as posições fixadas.
 */
export function FlowCanvas({ block, onChange, spaceId }: BlockEditProps) {
  const b = block as FlowBlockT;
  const data = b.data;

  // Refs sempre FRESCOS para os handlers de arraste/menu (lidos fora do render).
  const dataRef = useRef(data);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    dataRef.current = data;
    onChangeRef.current = onChange;
  });

  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const dragRef = useRef<{
    id: string;
    sx: number;
    sy: number;
    ox: number;
    oy: number;
    moved: boolean;
    lx: number;
    ly: number;
  } | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [zoom, setZoom] = useState(1);
  const [expandido, setExpandido] = useState(false);

  const patch = (d: FlowData) => onChangeRef.current({ data: d } as Partial<Block>);
  const patchNode = (id: string, fn: (n: FlowNode) => FlowNode) =>
    patch({ ...dataRef.current, nodes: dataRef.current.nodes.map((n) => (n.id === id ? fn(n) : n)) });
  const patchEdge = (id: string, fn: (e: FlowEdge) => FlowEdge) =>
    patch({ ...dataRef.current, edges: dataRef.current.edges.map((e) => (e.id === id ? fn(e) : e)) });

  function toSVG(clientX: number, clientY: number) {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return { x: clientX, y: clientY };
    const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: pt.x, y: pt.y };
  }

  function onNodePointerDown(id: string, e: React.PointerEvent) {
    if (e.button !== 0) return; // só o botão esquerdo arrasta
    const placed = layoutFlow(dataRef.current).nodes.find((p) => p.node.id === id);
    if (!placed) return;
    const s = toSVG(e.clientX, e.clientY);
    dragRef.current = { id, sx: s.x, sy: s.y, ox: placed.x, oy: placed.y, moved: false, lx: placed.x, ly: placed.y };
    setDrag({ id, x: placed.x, y: placed.y });
  }

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const s = toSVG(e.clientX, e.clientY);
      d.moved = true;
      d.lx = Math.round(d.ox + (s.x - d.sx));
      d.ly = Math.round(d.oy + (s.y - d.sy));
      setDrag({ id: d.id, x: d.lx, y: d.ly });
    };
    const up = () => {
      const d = dragRef.current;
      dragRef.current = null;
      // Commit FORA do updater de estado (chamar setBlocks do pai dentro do
      // updater do setDrag = "setState durante render"). A posição ao vivo mora
      // no ref, então lemos dali.
      if (d?.moved) patchNode(d.id, (n) => ({ ...n, x: d.lx, y: d.ly }));
      setDrag(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.id]);

  // Dado exibido: durante o arraste, a posição ao vivo do nó.
  const dataView: FlowData = drag
    ? { ...data, nodes: data.nodes.map((n) => (n.id === drag.id ? { ...n, x: drag.x, y: drag.y } : n)) }
    : data;

  const selected: FlowSelection = menu ? { kind: menu.kind, id: menu.id } : null;
  const temPosicoes = data.nodes.some((n) => typeof n.x === "number");
  const zoomBtn = "px-1.5 py-0.5 text-text-muted hover:text-primary disabled:opacity-40";

  const body = (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-dashed border-border bg-surface-2">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-1.5">
        <span className="text-xs text-text-muted">
          Fluxograma · arraste os blocos · botão direito p/ estilizar
        </span>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center rounded-md border border-border">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.4, Math.round((z - 0.1) * 10) / 10))}
              className={zoomBtn}
              title="Diminuir zoom"
            >
              <ZoomOut className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="w-10 text-center text-2xs text-text-muted hover:text-primary"
              title="Zoom 100%"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(2.5, Math.round((z + 0.1) * 10) / 10))}
              className={zoomBtn}
              title="Aumentar zoom"
            >
              <ZoomIn className="size-3.5" />
            </button>
          </div>
          {temPosicoes && (
            <button
              type="button"
              onClick={() =>
                onChange({
                  data: { ...data, nodes: data.nodes.map((n) => ({ ...n, x: undefined, y: undefined })) },
                } as Partial<Block>)
              }
              className="rounded-md border border-border px-2 py-0.5 text-2xs text-text-muted hover:border-primary hover:text-primary"
            >
              Reorganizar
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpandido((v) => !v)}
            title={expandido ? "Reduzir" : "Expandir"}
            className="rounded-md border border-border p-1 text-text-muted hover:border-primary hover:text-primary"
          >
            {expandido ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </button>
        </div>
      </div>
      <div
        className="flex-1 overflow-auto px-2"
        style={{ maxHeight: expandido ? "100%" : 480 }}
        onClick={() => setMenu(null)}
      >
        <FlowView
          data={dataView}
          interactive={{
            svgRef,
            selected,
            zoom,
            onNodePointerDown,
            onNodeContextMenu: (id, e) => setMenu({ kind: "node", id, x: e.clientX, y: e.clientY }),
            onEdgeContextMenu: (id, e) => setMenu({ kind: "edge", id, x: e.clientX, y: e.clientY }),
          }}
        />
      </div>
    </div>
  );

  return (
    <>
      {expandido ? (
        <Dialog open onClose={() => setExpandido(false)} title="Fluxograma" size="xl" bodyClassName="p-2">
          <div className="h-[72vh]">{body}</div>
        </Dialog>
      ) : (
        body
      )}

      {menu?.kind === "node" && (
        <MenuFlutuante x={menu.x} y={menu.y} onClose={() => setMenu(null)}>
          <NodeMenu
            node={data.nodes.find((n) => n.id === menu.id)}
            spaceId={spaceId}
            patchNode={patchNode}
            onRemove={() => {
              patch({
                ...data,
                nodes: data.nodes.filter((n) => n.id !== menu.id),
                edges: data.edges.filter((e) => e.from !== menu.id && e.to !== menu.id),
              });
              setMenu(null);
            }}
          />
        </MenuFlutuante>
      )}
      {menu?.kind === "edge" && (
        <MenuFlutuante x={menu.x} y={menu.y} onClose={() => setMenu(null)}>
          <EdgeMenu
            edge={data.edges.find((e) => e.id === menu.id)}
            patchEdge={patchEdge}
            onRemove={() => {
              patch({ ...data, edges: data.edges.filter((e) => e.id !== menu.id) });
              setMenu(null);
            }}
          />
        </MenuFlutuante>
      )}
    </>
  );
}

// ── menu flutuante ───────────────────────────────────────────────────────────
function MenuFlutuante({
  x,
  y,
  onClose,
  children,
}: {
  x: number;
  y: number;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: x, top: y });
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    // mousedown no próximo tick para não fechar no próprio clique que abriu.
    const t = setTimeout(() => document.addEventListener("mousedown", onDoc), 0);
    document.addEventListener("keydown", onEsc);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [onClose]);
  // Reposiciona MEDINDO o menu: se não couber abaixo do cursor (perto do rodapé),
  // abre PARA CIMA; sempre mantém dentro da viewport. Roda antes do paint (sem piscar).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const left = Math.max(8, Math.min(x, window.innerWidth - r.width - 8));
    const top =
      y + r.height > window.innerHeight - 8 ? Math.max(8, y - r.height) : Math.max(8, y);
    setPos({ left, top });
  }, [x, y]);
  return createPortal(
    <div
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      style={{ position: "fixed", left: pos.left, top: pos.top, width: 244, zIndex: 60 }}
      className="max-h-[calc(100vh-16px)] overflow-y-auto rounded-xl border border-border bg-surface p-2.5 shadow-2"
    >
      {children}
    </div>,
    document.body,
  );
}

// ── controles reutilizáveis ──────────────────────────────────────────────────
function Linha({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-1.5 flex items-center justify-between gap-2 text-xs text-text-muted">
      <span className="shrink-0">{label}</span>
      <span className="flex items-center gap-1">{children}</span>
    </label>
  );
}
function Cor({ value, def, onChange }: { value?: string; def: string; onChange: (v: string) => void }) {
  return (
    <input
      type="color"
      value={value || def}
      onChange={(e) => onChange(e.target.value)}
      className="size-6 cursor-pointer rounded border border-border bg-transparent p-0"
    />
  );
}
function Seg<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: [T, React.ReactNode][];
  onChange: (v: T) => void;
}) {
  return (
    <span className="flex overflow-hidden rounded-md border border-border">
      {options.map(([v, node]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`px-1.5 py-0.5 text-xs ${value === v ? "bg-primary text-primary-fg" : "text-text-muted hover:bg-surface-2"}`}
        >
          {node}
        </button>
      ))}
    </span>
  );
}

const TIPOS: FlowNodeType[] = ["start", "process", "decision", "io", "subroutine", "end"];

function NodeMenu({
  node,
  spaceId,
  patchNode,
  onRemove,
}: {
  node: FlowNode | undefined;
  spaceId: string;
  patchNode: (id: string, fn: (n: FlowNode) => FlowNode) => void;
  onRemove: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [subindo, setSubindo] = useState(false);
  if (!node) return null;
  const s = node.style ?? {};
  const est = (p: Partial<NonNullable<FlowNode["style"]>>) =>
    patchNode(node.id, (n) => ({ ...n, style: { ...n.style, ...p } }));

  async function enviarImg(file: File) {
    setSubindo(true);
    try {
      const url = await uploadToAssets(file, spaceId);
      if (url) est({ iconImage: url });
    } finally {
      setSubindo(false);
    }
  }

  return (
    <div>
      <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-text-muted">Bloco</p>
      <Linha label="Tipo">
        <Select
          value={node.type}
          onChange={(v) => patchNode(node.id, (n) => ({ ...n, type: v as FlowNodeType }))}
          className="rounded-md border border-border bg-surface px-1.5 py-0.5 text-xs"
        >
          {TIPOS.map((t) => (
            <option key={t} value={t}>
              {FLOW_NODE_LABEL[t]}
            </option>
          ))}
        </Select>
      </Linha>
      <Linha label="Fonte">
        <Seg
          value={s.bold ? "b" : "n"}
          options={[["n", "N"], ["b", <strong key="b">B</strong>]]}
          onChange={(v) => est({ bold: v === "b" })}
        />
        <Seg
          value={s.italic ? "i" : "n"}
          options={[["n", "—"], ["i", <em key="i">I</em>]]}
          onChange={(v) => est({ italic: v === "i" })}
        />
      </Linha>
      <Linha label="Cor da fonte">
        <Cor value={s.fontColor} def="#1e1b2e" onChange={(v) => est({ fontColor: v })} />
      </Linha>
      <Linha label="Cor de fundo">
        <Cor value={s.bg} def="#ffffff" onChange={(v) => est({ bg: v })} />
      </Linha>
      <Linha label="Cor da borda">
        <Cor value={s.borderColor} def="#511C76" onChange={(v) => est({ borderColor: v })} />
      </Linha>
      <Linha label="Espessura borda">
        <input
          type="range"
          min={0}
          max={6}
          step={0.5}
          value={s.borderWidth ?? 1.5}
          onChange={(e) => est({ borderWidth: Number(e.target.value) })}
          className="w-20 accent-[var(--color-primary)]"
        />
      </Linha>
      <div className="my-2 border-t border-border" />
      <p className="mb-1 text-2xs font-semibold uppercase tracking-wide text-text-muted">Ícone</p>
      {s.iconImage ? (
        <div className="mb-1.5 flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.iconImage} alt="" className="size-6 rounded object-contain" />
          <button type="button" onClick={() => est({ iconImage: undefined })} className="text-xs text-rose-600 hover:underline">
            Remover imagem
          </button>
        </div>
      ) : (
        <div className="mb-1.5">
          <IconPicker value={s.icon} onChange={(icon) => est({ icon })} />
        </div>
      )}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={subindo}
        className="mb-1.5 inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-text-muted hover:border-primary hover:text-primary disabled:opacity-50"
      >
        <Upload className="size-3.5" /> {subindo ? "Enviando…" : "Imagem do ícone"}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void enviarImg(f);
          e.target.value = "";
        }}
      />
      <Linha label="Posição">
        <Seg<FlowIconPos>
          value={s.iconPos ?? "left"}
          options={[["top", "↑"], ["left", "←"], ["right", "→"], ["bottom", "↓"]]}
          onChange={(v) => est({ iconPos: v })}
        />
      </Linha>
      <div className="my-2 border-t border-border" />
      <button type="button" onClick={onRemove} className="flex w-full items-center gap-1.5 rounded-md px-1 py-1 text-xs text-rose-600 hover:bg-rose-500/10">
        <Trash2 className="size-3.5" /> Remover bloco
      </button>
    </div>
  );
}

const FORMATOS: [FlowEdgeShape, string][] = [
  ["bezier", "Flexível"],
  ["straight", "Reto"],
  ["step", "Cotovelo"],
  ["arc", "Arco"],
];

function EdgeMenu({
  edge,
  patchEdge,
  onRemove,
}: {
  edge: FlowEdge | undefined;
  patchEdge: (id: string, fn: (e: FlowEdge) => FlowEdge) => void;
  onRemove: () => void;
}) {
  if (!edge) return null;
  const s = edge.style ?? {};
  const est = (p: Partial<NonNullable<FlowEdge["style"]>>) =>
    patchEdge(edge.id, (e) => ({ ...e, style: { ...e.style, ...p } }));

  return (
    <div>
      <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-text-muted">Linha</p>
      <Linha label="Rótulo">
        <input
          value={edge.label ?? ""}
          onChange={(e) => patchEdge(edge.id, (ed) => ({ ...ed, label: e.target.value || undefined }))}
          placeholder="Sim/Não…"
          className="w-24 rounded-md border border-border bg-surface px-1.5 py-0.5 text-xs"
        />
      </Linha>
      <Linha label="Formato">
        <Select
          value={s.shape ?? "bezier"}
          onChange={(v) => est({ shape: v as FlowEdgeShape })}
          className="rounded-md border border-border bg-surface px-1.5 py-0.5 text-xs"
        >
          {FORMATOS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </Linha>
      <Linha label="Cor">
        <Cor value={s.color} def="#94a3b8" onChange={(v) => est({ color: v })} />
      </Linha>
      <Linha label="Espessura">
        <input
          type="range"
          min={1}
          max={5}
          step={0.5}
          value={s.width ?? 1.5}
          onChange={(e) => est({ width: Number(e.target.value) })}
          className="w-20 accent-[var(--color-primary)]"
        />
      </Linha>
      <Linha label="Setas">
        <Seg<FlowArrows>
          value={s.arrows ?? "end"}
          options={[["end", "→"], ["both", "↔"], ["none", "—"]]}
          onChange={(v) => est({ arrows: v })}
        />
      </Linha>
      <Linha label="Tam. da seta">
        <input
          type="range"
          min={6}
          max={16}
          step={1}
          value={s.arrowSize ?? 9}
          onChange={(e) => est({ arrowSize: Number(e.target.value) })}
          className="w-20 accent-[var(--color-primary)]"
        />
      </Linha>
      <div className="my-2 border-t border-border" />
      <button type="button" onClick={onRemove} className="flex w-full items-center gap-1.5 rounded-md px-1 py-1 text-xs text-rose-600 hover:bg-rose-500/10">
        <Trash2 className="size-3.5" /> Remover linha
      </button>
    </div>
  );
}
