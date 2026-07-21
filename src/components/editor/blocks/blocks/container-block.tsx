"use client";

import { Info, AlertTriangle, CheckCircle2, OctagonAlert, Plus, Minus } from "lucide-react";
import type { Block, CalloutVariant, PanelBg } from "@/lib/blocks/schema";
import { BlockIcon } from "../block-icon";
import { CALLOUT_ROTULO } from "@/lib/blocks/schema";
import type { BlockEditProps } from "../edit-types";

// MESMA paleta do render do portal (render.tsx) — a edição usava rosa onde o
// leitor via âmbar/vermelho, e o editor não pode mentir sobre o resultado.
const CALLOUT_META: Record<CalloutVariant, { icon: typeof Info; cls: string }> = {
  info: {
    icon: Info,
    cls: "border-brand-blue-500 bg-brand-blue-50/70 text-brand-blue-900 dark:bg-brand-blue-950/30 dark:text-brand-blue-100",
  },
  success: {
    icon: CheckCircle2,
    cls: "border-brand-purple-500 bg-brand-purple-50/70 text-brand-purple-900 dark:bg-brand-purple-950/30 dark:text-brand-purple-100",
  },
  warning: {
    icon: AlertTriangle,
    cls: "border-amber-500 bg-amber-50/70 text-amber-900 dark:bg-amber-950/25 dark:text-amber-100",
  },
  danger: {
    icon: OctagonAlert,
    cls: "border-red-500 bg-red-50/70 text-red-900 dark:bg-red-950/25 dark:text-red-100",
  },
};

/** Lista — usa <ul>/<ol> reais para o portal e o editor mostrarem o mesmo marcador. */
export function ListBlock({ block, children }: BlockEditProps) {
  return block.type === "orderedList" ? <ol>{children}</ol> : <ul>{children}</ul>;
}

export function CalloutBlock({ block, onChange, children }: BlockEditProps) {
  const b = block as Extract<Block, { type: "callout" }>;
  const meta = CALLOUT_META[b.data.variant];
  const Icon = meta.icon;
  const escolhido = b.styles?.icon;
  return (
    /* Mesmo cabeçalho rotulado do portal (padrão Microsoft Learn); o select
       fica invisível POR CIMA do rótulo — clicar no rótulo troca o tipo. */
    <div className={`rounded-r-md border-l-[3px] px-4 py-3.5 ${meta.cls}`}>
      <div className="relative flex w-fit items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em]">
        {escolhido ? (
          <BlockIcon name={escolhido} className="size-4 shrink-0" />
        ) : (
          <Icon className="size-4 shrink-0" />
        )}
        {CALLOUT_ROTULO[b.data.variant]}
        <select
          value={b.data.variant}
          onChange={(e) => onChange({ data: { variant: e.target.value as CalloutVariant } } as Partial<Block>)}
          className="absolute inset-0 cursor-pointer opacity-0"
          title="Tipo de destaque"
        >
          <option value="info">Nota</option>
          <option value="success">Dica</option>
          <option value="warning">Atenção</option>
          <option value="danger">Cuidado</option>
        </select>
      </div>
      <div className="mt-1.5 min-w-0">{children}</div>
    </div>
  );
}

const PANEL_BG: PanelBg[] = ["purple", "pink", "blue", "gray"];
const PANEL_CLS: Record<PanelBg, string> = {
  purple: "bg-brand-purple-50 dark:bg-brand-purple-950/30",
  pink: "bg-brand-pink-50 dark:bg-brand-pink-950/30",
  blue: "bg-brand-blue-50 dark:bg-brand-blue-950/30",
  gray: "bg-brand-gray-100 dark:bg-brand-gray-800",
};

export function PanelBlock({ block, onChange, children }: BlockEditProps) {
  const b = block as Extract<Block, { type: "panel" }>;
  return (
    <div className={`rounded-xl p-5 ${PANEL_CLS[b.data.bg]}`}>
      <div className="mb-2 flex gap-1">
        {PANEL_BG.map((bg) => (
          <button
            key={bg}
            type="button"
            title={bg}
            onClick={() => onChange({ data: { bg } } as Partial<Block>)}
            className={`size-4 rounded-full ${PANEL_CLS[bg]} ${b.data.bg === bg ? "ring-2 ring-primary" : "border border-border"}`}
          />
        ))}
      </div>
      {children}
    </div>
  );
}

/**
 * Região dividida. Espelha o render do portal (proporções via CSS var e divisor
 * entre divisões) para o que se edita ser o que o leitor vê. O número de
 * divisões e as proporções são ajustados no painel de Propriedades.
 */
export function ContainerBlock({ block, onChange, children }: BlockEditProps) {
  const b = block as Extract<Block, { type: "container" }>;
  const cols = Math.min(5, Math.max(2, b.data.columns || 2));
  const raw = b.data.ratios;
  const ratios =
    raw && raw.length === cols
      ? raw.map((r) => Math.min(12, Math.max(1, Math.round(Number(r) || 1))))
      : null;
  const grid: Record<number, string> = {
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-2 md:grid-cols-4",
    5: "grid-cols-2 md:grid-cols-5",
  };
  const divider = b.data.divider ? "[&>*+*]:border-l [&>*+*]:border-border [&>*+*]:pl-3" : "";

  return (
    <div className="rounded-lg border border-dashed border-border p-2">
      <div className="mb-2 flex items-center gap-2 text-xs text-text-muted">
        <span>
          {cols} divisões{ratios ? ` · ${ratios.join(":")}` : ""}
          {b.data.divider ? " · com divisor" : ""}
        </span>
        <button
          type="button"
          title="Menos divisões"
          onClick={() => onChange({ data: { ...b.data, columns: Math.max(2, cols - 1), ratios: undefined } } as Partial<Block>)}
          className="rounded p-0.5 hover:bg-surface-2"
        >
          <Minus className="size-3" />
        </button>
        <button
          type="button"
          title="Mais divisões"
          onClick={() => onChange({ data: { ...b.data, columns: Math.min(5, cols + 1), ratios: undefined } } as Partial<Block>)}
          className="rounded p-0.5 hover:bg-surface-2"
        >
          <Plus className="size-3" />
        </button>
      </div>
      <div
        className={`grid gap-3 ${ratios ? "[grid-template-columns:var(--block-cols)]" : grid[cols]} ${divider}`}
        style={ratios ? ({ "--block-cols": ratios.map((r) => `${r}fr`).join(" ") } as React.CSSProperties) : undefined}
      >
        {children}
      </div>
    </div>
  );
}

export function ColumnBlock({ children }: BlockEditProps) {
  return <div className="min-w-0 rounded-md border border-dashed border-border/60 p-2">{children}</div>;
}

export function StepsBlock({ children }: BlockEditProps) {
  return <div className="[counter-reset:step]">{children}</div>;
}

export function StepBlock({ children }: BlockEditProps) {
  return (
    <div className="relative mb-2 border-l-2 border-border pb-1 pl-8 [counter-increment:step] before:absolute before:left-[-13px] before:top-0 before:flex before:size-6 before:items-center before:justify-center before:rounded-full before:bg-primary before:text-xs before:font-semibold before:text-primary-fg before:content-[counter(step)]">
      {children}
    </div>
  );
}

export function ToggleBlock({ block, onChange, children }: BlockEditProps) {
  const b = block as Extract<Block, { type: "toggle" }>;
  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center gap-2 border-b border-border px-3">
        <BlockIcon name={b.styles?.icon} className="size-4 shrink-0 text-primary" />
        <input
          value={b.data.title}
          onChange={(e) => onChange({ data: { title: e.target.value } } as Partial<Block>)}
          placeholder="Título recolhível"
          className="w-full py-2 text-sm font-medium outline-none"
        />
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

export function AccordionBlock({ children }: BlockEditProps) {
  return <div className="space-y-1">{children}</div>;
}

export function TabsBlock({ children }: BlockEditProps) {
  return <div className="space-y-2">{children}</div>;
}

export function CardGridBlock({ block, onChange, children }: BlockEditProps) {
  const b = block as Extract<Block, { type: "cardGrid" }>;
  const cols = b.data.cols || 3;
  const grid = cols === 2 ? "sm:grid-cols-2" : cols === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3";
  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-xs text-text-muted">
        Colunas:
        {[2, 3, 4].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange({ data: { cols: n } } as Partial<Block>)}
            className={`rounded px-1.5 ${cols === n ? "bg-primary text-primary-fg" : "hover:bg-surface-2"}`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className={`grid gap-3 ${grid}`}>{children}</div>
    </div>
  );
}
