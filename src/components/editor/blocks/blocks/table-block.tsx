"use client";

import { Plus, Minus } from "lucide-react";
import type { Block, RichText as RT } from "@/lib/blocks/schema";
import { RichText } from "../rich-text/rich-text";
import type { BlockEditProps } from "../edit-types";

export function TableBlock({ block, onChange }: BlockEditProps) {
  const b = block as Extract<Block, { type: "table" }>;
  const rows = b.data.rows;
  const cols = rows[0]?.length ?? 0;

  const set = (next: RT[][]) => onChange({ data: { ...b.data, rows: next } } as Partial<Block>);

  const setCell = (r: number, c: number, text: RT) => {
    const next = rows.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? text : cell)) : row));
    set(next);
  };
  const addRow = () => set([...rows, Array.from({ length: cols }, () => [] as RT)]);
  const delRow = () => rows.length > 1 && set(rows.slice(0, -1));
  const addCol = () => set(rows.map((row) => [...row, [] as RT]));
  const delCol = () => cols > 1 && set(rows.map((row) => row.slice(0, -1)));

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-sm">
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => {
                const isHeader = r === 0 && b.data.hasHeader;
                return (
                  <td
                    key={c}
                    className={`border border-border p-2 align-top ${isHeader ? "bg-surface-2 font-semibold" : ""}`}
                  >
                    <RichText value={cell} onChange={(t) => setCell(r, c, t)} placeholder="…" />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center gap-2 border-t border-border bg-surface-2 px-2 py-1.5 text-xs text-text-muted">
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={b.data.hasHeader}
            onChange={(e) => onChange({ data: { ...b.data, hasHeader: e.target.checked } } as Partial<Block>)}
          />
          Cabeçalho
        </label>
        <span className="mx-1 h-3 w-px bg-border" />
        <button type="button" onClick={addRow} className="flex items-center gap-1 hover:text-text"><Plus className="size-3" /> linha</button>
        <button type="button" onClick={delRow} className="flex items-center gap-1 hover:text-text"><Minus className="size-3" /> linha</button>
        <button type="button" onClick={addCol} className="flex items-center gap-1 hover:text-text"><Plus className="size-3" /> coluna</button>
        <button type="button" onClick={delCol} className="flex items-center gap-1 hover:text-text"><Minus className="size-3" /> coluna</button>
      </div>
    </div>
  );
}
