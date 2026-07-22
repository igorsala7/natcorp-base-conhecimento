"use client";

import { Info, AlertTriangle, CheckCircle2, Lightbulb, OctagonAlert, Plus, Minus } from "lucide-react";
import type { Block, CalloutVariant, PanelBg } from "@/lib/blocks/schema";
import { BlockIcon } from "../block-icon";
import { CALLOUT_ROTULO } from "@/lib/blocks/schema";
import type { BlockEditProps } from "../edit-types";

// MESMA paleta do render do portal (render.tsx) — tons semânticos literais da
// referência (info=sky, success=emerald, warning=amber, danger=rose,
// note=violet). O editor não pode mentir sobre o resultado.
const CALLOUT_META: Record<CalloutVariant, { icon: typeof Info; cls: string; iconWrap: string }> = {
  info: {
    icon: Info,
    cls: "border-sky-200 bg-sky-50/70 dark:border-sky-900 dark:bg-sky-950/30",
    iconWrap: "bg-sky-100 text-sky-600 dark:bg-sky-900/60 dark:text-sky-400",
  },
  success: {
    icon: CheckCircle2,
    cls: "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30",
    iconWrap: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-400",
  },
  warning: {
    icon: AlertTriangle,
    cls: "border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/30",
    iconWrap: "bg-amber-100 text-amber-600 dark:bg-amber-900/60 dark:text-amber-400",
  },
  danger: {
    icon: OctagonAlert,
    cls: "border-rose-200 bg-rose-50/70 dark:border-rose-900 dark:bg-rose-950/30",
    iconWrap: "bg-rose-100 text-rose-600 dark:bg-rose-900/60 dark:text-rose-400",
  },
  note: {
    icon: Lightbulb,
    cls: "border-violet-200 bg-violet-50/70 dark:border-violet-900 dark:bg-violet-950/30",
    iconWrap: "bg-violet-100 text-violet-600 dark:bg-violet-900/60 dark:text-violet-400",
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
    /* Anatomia do portal (WYSIWYG): quadrado de ícone + TÍTULO editável.
       O select fica invisível POR CIMA do ícone — clicar nele troca o tipo. */
    <div className={`my-1 flex gap-3 rounded-lg border p-4 ${meta.cls}`}>
      <span
        className={`relative mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md ${meta.iconWrap}`}
      >
        {escolhido ? (
          <BlockIcon name={escolhido} className="size-4" />
        ) : (
          <Icon className="size-4" />
        )}
        <select
          value={b.data.variant}
          onChange={(e) =>
            onChange({ data: { ...b.data, variant: e.target.value as CalloutVariant } } as Partial<Block>)
          }
          className="absolute inset-0 cursor-pointer opacity-0"
          title="Tipo de destaque (clique para trocar)"
        >
          <option value="info">Nota</option>
          <option value="success">Dica</option>
          <option value="warning">Atenção</option>
          <option value="danger">Cuidado</option>
          <option value="note">Observação</option>
        </select>
      </span>
      <div className="min-w-0 flex-1">
        <input
          value={b.data.title ?? ""}
          onChange={(e) =>
            onChange({ data: { ...b.data, title: e.target.value || undefined } } as Partial<Block>)
          }
          placeholder={CALLOUT_ROTULO[b.data.variant]}
          title="Título do destaque (vazio = rótulo do tipo)"
          className="w-full bg-transparent text-sm font-semibold text-text outline-none placeholder:opacity-60"
        />
        <div className="mt-0.5 min-w-0">{children}</div>
      </div>
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

export function StepBlock({ block, onChange, children }: BlockEditProps) {
  const b = block as Extract<Block, { type: "step" }>;
  return (
    /* MESMA anatomia do portal: número 32px com anel roxo e conector em
       degradê. Aqui o conector fica sempre visível — no editor cada passo
       vive num wrapper próprio e o "último" não é irmão direto. */
    <div className="relative pb-6 pl-11 [counter-increment:step] before:absolute before:left-0 before:top-0 before:z-10 before:flex before:size-8 before:items-center before:justify-center before:rounded-full before:bg-primary before:text-sm before:font-semibold before:text-primary-fg before:shadow-1 before:ring-4 before:ring-brand-purple-50 before:content-[counter(step)] after:absolute after:bottom-0 after:left-[15px] after:top-8 after:w-px after:bg-gradient-to-b after:from-brand-purple-300 after:to-brand-purple-100 dark:before:ring-brand-purple-950 dark:after:from-brand-purple-800 dark:after:to-brand-purple-950">
      <input
        value={b.data?.title ?? ""}
        onChange={(e) =>
          onChange({
            data: e.target.value.trim() ? { title: e.target.value } : undefined,
          } as Partial<Block>)
        }
        placeholder="Título do passo (opcional)"
        aria-label="Título do passo"
        className="w-full bg-transparent pt-1 text-sm font-semibold outline-none placeholder:font-normal placeholder:text-text-muted/60"
      />
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
