"use client";

import { Plus, Trash2 } from "lucide-react";
import type { Block } from "@/lib/blocks/schema";
import {
  CHART_TYPES,
  chartSupportsZ,
  chartSupportsMedian,
  chartIsCircular,
  type ChartColumn,
  type ChartData,
  type ChartRow,
} from "@/lib/blocks/schema";
import { controlClass } from "@/components/ui/input";
import { rowsToChart } from "@/lib/blocks/tabular";
import type { EditorActions } from "./edit-types";
import { DataImport } from "./data-import";

type ChartBlock = Extract<Block, { type: "chart" }>;

/**
 * Propriedades do gráfico: tipo (troca SEM perder dados), grade de dados
 * editável, eixos X/Y/(Z) e mediana. A importação de CSV/Excel (colar/upload)
 * entra na Fase B, plugando aqui.
 */
export function ChartProps({ block, actions }: { block: ChartBlock; actions: EditorActions }) {
  const d = block.data;
  const set = (patch: Partial<ChartData>) =>
    actions.patch(block.id, { data: { ...d, ...patch } } as Partial<Block>);

  // ── edição da grade de dados ──────────────────────────────────────────────
  const setCell = (ri: number, key: string, value: string) => {
    const rows = d.rows.map((r, i) => (i === ri ? { ...r, [key]: value } : r));
    set({ rows });
  };
  const setColLabel = (key: string, label: string) => {
    const columns = d.columns.map((c) => (c.key === key ? { ...c, label } : c));
    const series = d.series.map((s) => (s.key === key ? { ...s, label } : s));
    set({ columns, series });
  };
  const addRow = () => {
    const r: ChartRow = {};
    for (const c of d.columns) r[c.key] = "";
    set({ rows: [...d.rows, r] });
  };
  const removeRow = (ri: number) => set({ rows: d.rows.filter((_, i) => i !== ri) });
  const addCol = () => {
    const n = d.columns.length + 1;
    let key = `col${n}`;
    while (d.columns.some((c) => c.key === key)) key = `${key}_`;
    const col: ChartColumn = { key, label: `Coluna ${n}` };
    set({
      columns: [...d.columns, col],
      rows: d.rows.map((r) => ({ ...r, [key]: "" })),
      series: [...d.series, { key, label: col.label }],
    });
  };
  const removeCol = (key: string) => {
    if (d.columns.length <= 1) return;
    const columns = d.columns.filter((c) => c.key !== key);
    const series = d.series.filter((s) => s.key !== key);
    const rows = d.rows.map((r) => {
      const o = { ...r };
      delete o[key];
      return o;
    });
    set({
      columns,
      series,
      rows,
      xKey: d.xKey === key ? (columns[0]?.key ?? "") : d.xKey,
      zKey: d.zKey === key ? undefined : d.zKey,
    });
  };

  // ── eixos ─────────────────────────────────────────────────────────────────
  const isSerie = (key: string) => d.series.some((s) => s.key === key);
  const toggleSerie = (key: string) => {
    const col = d.columns.find((c) => c.key === key);
    if (!col) return;
    set({
      series: isSerie(key)
        ? d.series.filter((s) => s.key !== key)
        : [...d.series, { key, label: col.label }],
    });
  };

  const circular = chartIsCircular(d.chartType);

  return (
    <div className="space-y-4">
      {/* Tipo — troca preservando os dados */}
      <Grupo title="Tipo de gráfico">
        <select
          value={d.chartType}
          onChange={(e) => set({ chartType: e.target.value as ChartData["chartType"] })}
          className={controlClass}
        >
          {CHART_TYPES.map((t) => (
            <option key={t.type} value={t.type}>
              {t.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[0.6875rem] text-text-muted">
          Trocar o tipo mantém os dados — teste qual fica melhor.
        </p>
      </Grupo>

      <Grupo title="Título">
        <input
          value={d.title ?? ""}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="Opcional"
          className={controlClass}
        />
      </Grupo>

      {/* Importar de CSV/Excel — cola ou upload, detecta colunas sozinho */}
      <Grupo title="Importar dados">
        <DataImport
          onRows={(rows) => {
            const parsed = rowsToChart(rows);
            // Colunas mudam → limpa o Z (podia apontar p/ coluna que sumiu).
            if (parsed) set({ ...parsed, zKey: undefined });
          }}
        />
      </Grupo>

      {/* Grade de dados */}
      <Grupo title="Dados">
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                {d.columns.map((c) => (
                  <th key={c.key} className="border-b border-border p-1">
                    <div className="flex items-center gap-1">
                      <input
                        value={c.label}
                        onChange={(e) => setColLabel(c.key, e.target.value)}
                        className="w-full min-w-[68px] rounded bg-surface-2 px-1.5 py-1 font-semibold outline-none focus:ring-1 focus:ring-primary"
                      />
                      <button
                        type="button"
                        onClick={() => removeCol(c.key)}
                        title="Remover coluna"
                        className="shrink-0 text-text-muted hover:text-rose-600"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </th>
                ))}
                <th className="border-b border-border p-1">
                  <button
                    type="button"
                    onClick={addCol}
                    title="Adicionar coluna"
                    className="text-text-muted hover:text-primary"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {d.rows.map((r, ri) => (
                <tr key={ri}>
                  {d.columns.map((c) => (
                    <td key={c.key} className="border-b border-border/60 p-0.5">
                      <input
                        value={String(r[c.key] ?? "")}
                        onChange={(e) => setCell(ri, c.key, e.target.value)}
                        className="w-full min-w-[68px] rounded px-1.5 py-1 outline-none focus:ring-1 focus:ring-primary"
                      />
                    </td>
                  ))}
                  <td className="p-0.5 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(ri)}
                      title="Remover linha"
                      className="text-text-muted hover:text-rose-600"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={addRow}
          className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-text-muted hover:border-primary hover:text-primary"
        >
          <Plus className="size-3.5" /> Linha
        </button>
      </Grupo>

      {/* Eixos */}
      <Grupo title={circular ? "Rótulo (fatias)" : "Eixo X"}>
        <select value={d.xKey} onChange={(e) => set({ xKey: e.target.value })} className={controlClass}>
          {d.columns.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      </Grupo>

      <Grupo title={circular ? "Valor" : "Séries (Y)"}>
        <div className="flex flex-wrap gap-1.5">
          {d.columns
            .filter((c) => c.key !== d.xKey)
            .map((c) => (
              <label
                key={c.key}
                className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
                  isSerie(c.key)
                    ? "border-primary bg-brand-purple-50 text-primary dark:bg-brand-purple-950/30"
                    : "border-border text-text-muted hover:border-border-strong"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSerie(c.key)}
                  onChange={() => toggleSerie(c.key)}
                  className="size-3.5 accent-[var(--color-primary)]"
                />
                {c.label}
              </label>
            ))}
        </div>
        {circular && d.series.length > 1 && (
          <p className="mt-1 text-[0.6875rem] text-text-muted">
            Pizza/rosca usam a primeira série.
          </p>
        )}
      </Grupo>

      {chartSupportsZ(d.chartType) && (
        <Grupo title="Eixo Z (tamanho da bolha)">
          <select
            value={d.zKey ?? ""}
            onChange={(e) => set({ zKey: e.target.value || undefined })}
            className={controlClass}
          >
            <option value="">— nenhum —</option>
            {d.columns.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </Grupo>
      )}

      {/* Opções */}
      <Grupo title="Opções">
        <div className="space-y-1.5">
          {chartSupportsMedian(d.chartType) && (
            <Check label="Linha de mediana" checked={!!d.showMedian} onChange={(v) => set({ showMedian: v })} />
          )}
          <Check label="Legenda" checked={d.legend !== false} onChange={(v) => set({ legend: v })} />
          {!circular && (
            <Check label="Grade" checked={d.grid !== false} onChange={(v) => set({ grid: v })} />
          )}
        </div>
      </Grupo>
    </div>
  );
}

function Grupo({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-text-muted">
        {title}
      </p>
      {children}
    </div>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-3.5 accent-[var(--color-primary)]"
      />
      {label}
    </label>
  );
}
