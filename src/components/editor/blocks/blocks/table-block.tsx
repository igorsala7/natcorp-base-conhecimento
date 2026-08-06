"use client";

import { useState } from "react";
import { Ban, Minus, Plus } from "lucide-react";
import type { Block, RichText as RT, TableColor } from "@/lib/blocks/schema";
import {
  TABLE_CELL_BG,
  TABLE_CELL_SWATCH,
  TABLE_COLORS,
  TABLE_COLOR_LABEL,
} from "@/lib/blocks/table-styles";
import { RichText } from "../rich-text/rich-text";
import type { BlockEditProps } from "../edit-types";
import { Select } from "@/components/ui/select";

type Escopo = "cell" | "row" | "col";

export function TableBlock({ block, onChange }: BlockEditProps) {
  const b = block as Extract<Block, { type: "table" }>;
  const rows = b.data.rows;
  const cols = rows[0]?.length ?? 0;
  const cellColors = b.data.cellColors;
  const borders = b.data.borders ?? "rows";
  const striped = b.data.striped ?? true;

  const [foco, setFoco] = useState<{ r: number; c: number } | null>(null);
  const [escopo, setEscopo] = useState<Escopo>("cell");

  const set = (next: RT[][]) => onChange({ data: { ...b.data, rows: next } } as Partial<Block>);
  const patchData = (patch: Partial<typeof b.data>) =>
    onChange({ data: { ...b.data, ...patch } } as Partial<Block>);

  const setCell = (r: number, c: number, text: RT) => {
    const next = rows.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? text : cell)) : row));
    set(next);
  };
  const addRow = () => set([...rows, Array.from({ length: cols }, () => [] as RT)]);
  const delRow = () => rows.length > 1 && set(rows.slice(0, -1));
  const addCol = () => set(rows.map((row) => [...row, [] as RT]));
  const delCol = () => cols > 1 && set(rows.map((row) => row.slice(0, -1)));

  /** Pinta a célula/linha/coluna em foco com `color` (null = remove). */
  function aplicarCor(color: TableColor | null) {
    if (!foco) return;
    const mat: (TableColor | null)[][] = rows.map((row, r) =>
      row.map((_, c) => cellColors?.[r]?.[c] ?? null),
    );
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < (rows[r]?.length ?? 0); c++) {
        const alvo =
          escopo === "cell" ? r === foco.r && c === foco.c : escopo === "row" ? r === foco.r : c === foco.c;
        if (alvo) mat[r]![c] = color;
      }
    }
    patchData({ cellColors: mat });
  }

  const controlClass =
    "h-7 rounded-md border border-border bg-surface px-1.5 text-xs text-text focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="overflow-x-auto rounded-lg border border-border shadow-1">
      <table className="w-full border-collapse text-sm">
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => {
                const isHeader = r === 0 && b.data.hasHeader;
                const cor = cellColors?.[r]?.[c] ?? null;
                const zebra =
                  striped && !cor && !isHeader && (r - (b.data.hasHeader ? 1 : 0)) % 2 === 1
                    ? "bg-surface-2/40"
                    : "";
                const bordas =
                  borders === "none" ? "" : borders === "all" ? "border border-border" : "border-b border-border";
                return (
                  <td
                    key={c}
                    onFocusCapture={() => setFoco({ r, c })}
                    className={`p-2 align-top ${bordas} ${isHeader ? "bg-surface-2 font-semibold" : ""} ${zebra} ${
                      cor ? TABLE_CELL_BG[cor] : ""
                    } ${foco?.r === r && foco?.c === c ? "ring-1 ring-inset ring-primary" : ""}`}
                  >
                    <RichText value={cell} onChange={(t) => setCell(r, c, t)} placeholder="…" />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border bg-surface-2 px-2 py-1.5 text-xs text-text-muted">
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={b.data.hasHeader}
            onChange={(e) => patchData({ hasHeader: e.target.checked })}
          />
          Cabeçalho
        </label>
        <span className="h-3 w-px bg-border" />
        <button type="button" onClick={addRow} className="flex items-center gap-1 hover:text-text"><Plus className="size-3" /> linha</button>
        <button type="button" onClick={delRow} className="flex items-center gap-1 hover:text-text"><Minus className="size-3" /> linha</button>
        <button type="button" onClick={addCol} className="flex items-center gap-1 hover:text-text"><Plus className="size-3" /> coluna</button>
        <button type="button" onClick={delCol} className="flex items-center gap-1 hover:text-text"><Minus className="size-3" /> coluna</button>

        <span className="h-3 w-px bg-border" />
        <label className="flex items-center gap-1">
          Bordas
          <Select
            value={borders}
            onChange={(v) => patchData({ borders: v as "all" | "rows" | "none" })}
            className={`${controlClass} w-auto`}
          >
            <option value="rows">Linhas</option>
            <option value="all">Grade</option>
            <option value="none">Nenhuma</option>
          </Select>
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={striped} onChange={(e) => patchData({ striped: e.target.checked })} />
          Zebra
        </label>

        <span className="h-3 w-px bg-border" />
        {/* Cor da célula/linha/coluna em foco. */}
        <div className="flex items-center gap-1.5">
          <span>Cor</span>
          <Select value={escopo} onChange={(v) => setEscopo(v as Escopo)} className={`${controlClass} w-auto`} title="Aplicar a…">
            <option value="cell">célula</option>
            <option value="row">linha</option>
            <option value="col">coluna</option>
          </Select>
          <button
            type="button"
            title="Sem cor"
            disabled={!foco}
            onClick={() => aplicarCor(null)}
            className="flex size-5 items-center justify-center rounded-full border border-border text-text-muted hover:text-text disabled:opacity-40"
          >
            <Ban className="size-3" />
          </button>
          {TABLE_COLORS.map((cor) => (
            <button
              key={cor}
              type="button"
              title={`${TABLE_COLOR_LABEL[cor]}${foco ? "" : " (selecione uma célula)"}`}
              disabled={!foco}
              onClick={() => aplicarCor(cor)}
              className={`size-5 rounded-full border border-border ${TABLE_CELL_SWATCH[cor]} disabled:opacity-40`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
