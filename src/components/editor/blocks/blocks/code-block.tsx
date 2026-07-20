"use client";

import type { Block } from "@/lib/blocks/schema";
import type { BlockEditProps } from "../edit-types";

export function CodeBlock({ block, onChange }: BlockEditProps) {
  const b = block as Extract<Block, { type: "code" }>;
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface-2">
      <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
        <input
          value={b.data.language ?? ""}
          onChange={(e) => onChange({ data: { ...b.data, language: e.target.value || null } } as Partial<Block>)}
          placeholder="linguagem"
          className="w-32 bg-transparent text-xs text-text-muted outline-none"
        />
      </div>
      <textarea
        value={b.data.code}
        onChange={(e) => onChange({ data: { ...b.data, code: e.target.value } } as Partial<Block>)}
        placeholder="Cole ou escreva o código…"
        spellCheck={false}
        rows={Math.max(3, b.data.code.split("\n").length)}
        className="w-full resize-none bg-transparent p-3 font-mono text-sm outline-none"
      />
    </div>
  );
}

export function MermaidBlock({ block, onChange }: BlockEditProps) {
  const b = block as Extract<Block, { type: "mermaid" }>;
  return (
    <div className="overflow-hidden rounded-lg border border-dashed border-border bg-surface-2">
      <div className="border-b border-border px-3 py-1.5 text-xs text-text-muted">Diagrama Mermaid</div>
      <textarea
        value={b.data.code}
        onChange={(e) => onChange({ data: { code: e.target.value } } as Partial<Block>)}
        placeholder="graph TD; A--&gt;B;"
        spellCheck={false}
        rows={Math.max(3, b.data.code.split("\n").length)}
        className="w-full resize-none bg-transparent p-3 font-mono text-sm outline-none"
      />
    </div>
  );
}
