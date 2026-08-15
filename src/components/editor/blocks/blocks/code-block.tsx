"use client";

import type { Block } from "@/lib/blocks/schema";
import type { BlockEditProps } from "../edit-types";

export function CodeBlock({ block, onChange }: BlockEditProps) {
  const b = block as Extract<Block, { type: "code" }>;
  return (
    /* Janela estilo terminal — o MESMO chrome do portal (WYSIWYG). */
    <div className="overflow-hidden rounded-lg border border-brand-gray-800 bg-brand-gray-950 shadow-1">
      {/* Linguagem e nome do arquivo agora vivem no painel de propriedades —
          aqui só o cabeçalho da janela (WYSIWYG). */}
      <div className="flex items-center justify-between gap-2 border-b border-brand-gray-800 px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="size-2.5 shrink-0 rounded-full bg-rose-500/80" />
          <span className="size-2.5 shrink-0 rounded-full bg-amber-500/80" />
          <span className="size-2.5 shrink-0 rounded-full bg-emerald-500/80" />
          {b.data.filename && (
            <span className="ml-2 min-w-0 truncate font-mono text-xs text-brand-gray-400">{b.data.filename}</span>
          )}
        </div>
        {b.data.language && (
          <span className="shrink-0 font-mono text-2xs uppercase tracking-[0.1em] text-brand-gray-500">
            {b.data.language}
          </span>
        )}
      </div>
      <textarea
        value={b.data.code}
        onChange={(e) => onChange({ data: { ...b.data, code: e.target.value } } as Partial<Block>)}
        placeholder="Cole ou escreva o código…"
        spellCheck={false}
        rows={Math.max(3, b.data.code.split("\n").length)}
        className="w-full resize-none bg-transparent p-4 font-mono text-[13px] leading-[1.6] text-brand-gray-100 outline-none placeholder:text-brand-gray-600"
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
