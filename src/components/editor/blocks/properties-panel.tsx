"use client";

import { X } from "lucide-react";
import type {
  Block,
  BlockStyles,
  SpaceScale,
  StyleAlign,
  StyleBg,
  StyleBorderColor,
  StyleBorderWidth,
  StyleFontSize,
  StyleRadius,
  StyleWidth,
} from "@/lib/blocks/schema";
import { BLOCKS } from "@/lib/blocks/registry.meta";
import { IconPicker } from "./icon-picker";
import type { EditorActions } from "./edit-types";

const SCALE: SpaceScale[] = [0, 1, 2, 3, 4, 5, 6];
const BGS: StyleBg[] = ["none", "purple", "pink", "blue", "gray", "dark"];
const RADII: StyleRadius[] = ["none", "sm", "md", "lg", "xl", "2xl"];
const ALIGNS: StyleAlign[] = ["left", "center", "right"];
const FONTS: StyleFontSize[] = ["xs", "sm", "base", "lg", "xl", "2xl", "3xl"];
const BORDER_WIDTHS: StyleBorderWidth[] = [0, 1, 2, 4, 8];
const BORDER_COLORS: StyleBorderColor[] = ["border", "primary", "pink", "blue", "gray", "dark"];
const WIDTHS: { key: StyleWidth; label: string }[] = [
  { key: "auto", label: "Auto" },
  { key: "third", label: "1/3" },
  { key: "half", label: "1/2" },
  { key: "twoThirds", label: "2/3" },
  { key: "threeQuarters", label: "3/4" },
  { key: "full", label: "100%" },
];

const BG_SWATCH: Record<StyleBg, string> = {
  none: "bg-surface border border-border",
  purple: "bg-brand-purple-200",
  pink: "bg-brand-pink-200",
  blue: "bg-brand-blue-200",
  gray: "bg-brand-gray-300",
  dark: "bg-brand-purple-900",
};
const BORDER_SWATCH: Record<StyleBorderColor, string> = {
  border: "bg-border",
  primary: "bg-primary",
  pink: "bg-brand-pink-400",
  blue: "bg-brand-blue-400",
  gray: "bg-brand-gray-300",
  dark: "bg-brand-purple-900",
};

/** Proporções prontas para 2 divisões (ex.: imagem + texto). */
const RATIO_PRESETS: { label: string; hint: string; ratios: number[] }[] = [
  { label: "1 : 1", hint: "Metade e metade", ratios: [1, 1] },
  { label: "1 : 2", hint: "Estreita à esquerda (ex.: imagem + texto)", ratios: [1, 2] },
  { label: "2 : 1", hint: "Estreita à direita (ex.: texto + imagem)", ratios: [2, 1] },
  { label: "1 : 3", hint: "Bem estreita à esquerda", ratios: [1, 3] },
  { label: "3 : 1", hint: "Bem estreita à direita", ratios: [3, 1] },
];

export function PropertiesPanel({
  block,
  actions,
  onClose,
}: {
  block: Block;
  actions: EditorActions;
  onClose: () => void;
}) {
  const styles = block.styles ?? {};
  const isContainer = block.type === "container";
  const children = "children" in block ? (block.children ?? []) : [];

  const set = (patch: Partial<BlockStyles>) => {
    const next: BlockStyles = { ...styles, ...patch };
    // Remove chaves "default"/none para manter o documento enxuto.
    (Object.keys(next) as (keyof BlockStyles)[]).forEach((k) => {
      const v = next[k];
      if (v === undefined || v === "none" || v === 0 || v === "auto") delete next[k];
    });
    actions.patch(block.id, { styles: Object.keys(next).length ? next : undefined } as Partial<Block>);
  };

  /** Muda o nº de divisões da região criando/removendo colunas de verdade. */
  const setColumns = (n: number) => {
    const current = children.length;
    if (n > current) {
      for (let i = 0; i < n - current; i++) actions.addChild(block.id, "column");
    } else if (n < current) {
      for (const c of children.slice(n)) actions.remove(c.id);
    }
    actions.patch(block.id, { data: { columns: n } } as Partial<Block>);
  };

  const containerData = isContainer
    ? (block as Extract<Block, { type: "container" }>).data
    : null;
  const setContainer = (patch: Partial<NonNullable<typeof containerData>>) => {
    if (!containerData) return;
    actions.patch(block.id, { data: { ...containerData, ...patch } } as Partial<Block>);
  };

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">Propriedades</h3>
          <p className="text-xs text-text-muted">{BLOCKS[block.type].label}</p>
        </div>
        <button type="button" onClick={onClose} className="rounded p-1 text-text-muted hover:bg-surface-2">
          <X className="size-4" />
        </button>
      </div>

      <div className="space-y-5 overflow-auto p-4">
        {/* ── Divisões da região (container) ───────────────────────────── */}
        {isContainer && containerData && (
          <Section title="Divisões da região">
            <Field label="Quantidade de divisões">
              <div className="flex gap-1">
                {[2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setColumns(n)}
                    className={`flex-1 rounded-md border py-1 text-xs ${
                      (containerData.columns || 2) === n
                        ? "border-primary text-primary"
                        : "border-border text-text-muted"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </Field>

            {(containerData.columns || 2) === 2 && (
              <Field label="Proporção">
                <div className="flex flex-wrap gap-1">
                  {RATIO_PRESETS.map((p) => {
                    const active = (containerData.ratios ?? []).join(":") === p.ratios.join(":");
                    return (
                      <button
                        key={p.label}
                        type="button"
                        title={p.hint}
                        onClick={() => setContainer({ ratios: p.ratios })}
                        className={`rounded-md border px-2 py-1 text-xs ${
                          active ? "border-primary text-primary" : "border-border text-text-muted"
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </Field>
            )}

            <Field label="Proporção de cada divisão">
              <div className="flex gap-1">
                {Array.from({ length: containerData.columns || 2 }, (_, i) => {
                  const cur = containerData.ratios?.[i] ?? 1;
                  return (
                    <input
                      key={i}
                      type="number"
                      min={1}
                      max={12}
                      value={cur}
                      onChange={(e) => {
                        const n = containerData.columns || 2;
                        const base = Array.from({ length: n }, (_, j) => containerData.ratios?.[j] ?? 1);
                        base[i] = Math.min(12, Math.max(1, Number(e.target.value) || 1));
                        setContainer({ ratios: base });
                      }}
                      className="w-full rounded-md border border-border bg-bg px-1 py-1 text-center text-xs outline-none focus:border-primary"
                    />
                  );
                })}
              </div>
            </Field>

            <label className="flex items-center gap-2 text-xs text-text-muted">
              <input
                type="checkbox"
                checked={!!containerData.divider}
                onChange={(e) => setContainer({ divider: e.target.checked })}
              />
              Mostrar divisor entre as divisões
            </label>
          </Section>
        )}

        {/* ── Ícone ────────────────────────────────────────────────────── */}
        <Section title="Ícone da região">
          <IconPicker value={styles.icon} onChange={(icon) => set({ icon })} />
          <p className="mt-1 text-[11px] text-text-muted">
            Aparece junto do título (destaque, recolhível, card, banner) ou no topo da região.
          </p>
        </Section>

        {/* ── Tamanho e posição ────────────────────────────────────────── */}
        <Section title="Tamanho e posição">
          <Field label="Largura da região">
            <div className="flex flex-wrap gap-1">
              {WIDTHS.map((w) => (
                <button
                  key={w.key}
                  type="button"
                  onClick={() => set({ width: w.key })}
                  className={`rounded-md border px-2 py-1 text-xs ${
                    (styles.width ?? "auto") === w.key
                      ? "border-primary text-primary"
                      : "border-border text-text-muted"
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Posição na página">
            <div className="flex gap-1">
              {ALIGNS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => set({ justify: a })}
                  disabled={!styles.width || styles.width === "full"}
                  className={`flex-1 rounded-md border px-2 py-1 text-xs disabled:opacity-40 ${
                    (styles.justify ?? "left") === a
                      ? "border-primary text-primary"
                      : "border-border text-text-muted"
                  }`}
                >
                  {a === "left" ? "Esq." : a === "center" ? "Centro" : "Dir."}
                </button>
              ))}
            </div>
            {(!styles.width || styles.width === "full") && (
              <p className="mt-1 text-[11px] text-text-muted">Defina uma largura menor que 100% para posicionar.</p>
            )}
          </Field>
          <Field label="Altura mínima">
            <ScaleSelect value={styles.minHeight ?? 0} onChange={(v) => set({ minHeight: v })} />
          </Field>
        </Section>

        {/* ── Espaçamento ──────────────────────────────────────────────── */}
        <Section title="Espaçamento">
          <Field label="Interno horizontal">
            <ScaleSelect value={styles.paddingX ?? 0} onChange={(v) => set({ paddingX: v })} />
          </Field>
          <Field label="Interno vertical">
            <ScaleSelect value={styles.paddingY ?? 0} onChange={(v) => set({ paddingY: v })} />
          </Field>
          <Field label="Margem vertical">
            <ScaleSelect value={styles.marginY ?? 0} onChange={(v) => set({ marginY: v })} />
          </Field>
        </Section>

        {/* ── Texto ────────────────────────────────────────────────────── */}
        <Section title="Texto">
          <Field label="Tamanho da fonte">
            <div className="flex flex-wrap gap-1">
              {FONTS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => set({ fontSize: f })}
                  className={`rounded-md border px-2 py-1 text-xs ${
                    styles.fontSize === f ? "border-primary text-primary" : "border-border text-text-muted"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Alinhamento do texto">
            <div className="flex gap-1">
              {ALIGNS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => set({ align: a })}
                  className={`flex-1 rounded-md border px-2 py-1 text-xs ${
                    styles.align === a ? "border-primary text-primary" : "border-border text-text-muted"
                  }`}
                >
                  {a === "left" ? "Esq." : a === "center" ? "Centro" : "Dir."}
                </button>
              ))}
            </div>
          </Field>
        </Section>

        {/* ── Aparência ────────────────────────────────────────────────── */}
        <Section title="Aparência">
          <Field label="Cor de fundo">
            <div className="flex flex-wrap gap-1.5">
              {BGS.map((bg) => (
                <button
                  key={bg}
                  type="button"
                  title={bg}
                  onClick={() => set({ bgColor: bg })}
                  className={`size-7 rounded-md ${BG_SWATCH[bg]} ${
                    (styles.bgColor ?? "none") === bg ? "ring-2 ring-primary ring-offset-1 ring-offset-surface" : ""
                  }`}
                />
              ))}
            </div>
          </Field>

          <Field label="Espessura da borda">
            <div className="flex gap-1">
              {BORDER_WIDTHS.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => set({ borderWidth: w })}
                  className={`flex-1 rounded-md border py-1 text-xs ${
                    (styles.borderWidth ?? 0) === w ? "border-primary text-primary" : "border-border text-text-muted"
                  }`}
                >
                  {w === 0 ? "sem" : `${w}px`}
                </button>
              ))}
            </div>
          </Field>
          {!!styles.borderWidth && (
            <Field label="Cor da borda">
              <div className="flex flex-wrap gap-1.5">
                {BORDER_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    onClick={() => set({ borderColor: c })}
                    className={`size-7 rounded-md ${BORDER_SWATCH[c]} ${
                      (styles.borderColor ?? "border") === c
                        ? "ring-2 ring-primary ring-offset-1 ring-offset-surface"
                        : ""
                    }`}
                  />
                ))}
              </div>
            </Field>
          )}

          <Field label="Cantos arredondados">
            <div className="flex flex-wrap gap-1">
              {RADII.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => set({ borderRadius: r })}
                  className={`rounded-md border px-2 py-1 text-xs ${
                    (styles.borderRadius ?? "none") === r
                      ? "border-primary text-primary"
                      : "border-border text-text-muted"
                  }`}
                >
                  {r === "none" ? "0" : r}
                </button>
              ))}
            </div>
          </Field>
        </Section>
      </div>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">{title}</h4>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-text-muted">{label}</label>
      {children}
    </div>
  );
}

function ScaleSelect({ value, onChange }: { value: SpaceScale; onChange: (v: SpaceScale) => void }) {
  return (
    <div className="flex gap-1">
      {SCALE.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          className={`flex-1 rounded-md border py-1 text-xs ${
            value === s ? "border-primary text-primary" : "border-border text-text-muted"
          }`}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
