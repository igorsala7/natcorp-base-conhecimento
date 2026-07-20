"use client";

import type { Block, RichText as RT } from "@/lib/blocks/schema";
import { RichText } from "../rich-text/rich-text";
import { BlockIcon } from "../block-icon";
import type { BlockEditProps } from "../edit-types";

export function DividerBlock() {
  return <hr className="my-2 border-border" />;
}

export function SpacerBlock({ block, onChange }: BlockEditProps) {
  const b = block as Extract<Block, { type: "spacer" }>;
  const h = b.data.size === "sm" ? "h-3" : b.data.size === "lg" ? "h-12" : "h-6";
  return (
    <div className={`flex items-center justify-center rounded border border-dashed border-border ${h}`}>
      <select
        value={b.data.size}
        onChange={(e) => onChange({ data: { size: e.target.value as "sm" | "md" | "lg" } } as Partial<Block>)}
        className="bg-transparent text-xs text-text-muted outline-none"
      >
        <option value="sm">Pequeno</option>
        <option value="md">Médio</option>
        <option value="lg">Grande</option>
      </select>
    </div>
  );
}

export function ButtonBlock({ block, onChange }: BlockEditProps) {
  const b = block as Extract<Block, { type: "button" }>;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3">
      <input
        value={b.data.label}
        onChange={(e) => onChange({ data: { ...b.data, label: e.target.value } } as Partial<Block>)}
        placeholder="Texto do botão"
        className={`rounded-md px-4 py-2 text-sm font-medium outline-none ${
          b.data.variant === "secondary"
            ? "border border-border bg-surface-2"
            : "bg-primary text-primary-fg placeholder:text-primary-fg/60"
        }`}
      />
      <input
        value={b.data.href}
        onChange={(e) => onChange({ data: { ...b.data, href: e.target.value } } as Partial<Block>)}
        placeholder="Link (/docs/… ou https://…)"
        className="min-w-40 flex-1 bg-transparent text-sm text-text-muted outline-none"
      />
      <select
        value={b.data.variant}
        onChange={(e) => onChange({ data: { ...b.data, variant: e.target.value as "primary" | "secondary" } } as Partial<Block>)}
        className="rounded-md border border-border bg-surface px-2 py-1 text-xs outline-none"
      >
        <option value="primary">Primário</option>
        <option value="secondary">Secundário</option>
      </select>
    </div>
  );
}

const HERO_BG = ["purple", "blue", "gray", "dark"] as const;

export function HeroBlock({ block, onChange }: BlockEditProps) {
  const b = block as Extract<Block, { type: "hero" }>;
  const dark = b.data.bg === "dark";
  // ESPELHA `render.tsx` (case "hero"). Se divergir, o editor mente sobre o
  // que o leitor vai ver — é o contrato WYSIWYG do produto.
  const bgClass: Record<string, string> = {
    purple: "border-brand-purple-200 bg-brand-purple-50/60 dark:border-brand-purple-900 dark:bg-brand-purple-950/30",
    blue: "border-brand-blue-200 bg-brand-blue-50/60 dark:border-brand-blue-900 dark:bg-brand-blue-950/30",
    gray: "border-border bg-surface-2",
    dark: "border-brand-blue-800 bg-brand-blue-800 text-white dark:bg-brand-blue-950",
  };
  const set = (patch: Partial<Extract<Block, { type: "hero" }>["data"]>) =>
    onChange({ data: { ...b.data, ...patch } } as Partial<Block>);
  return (
    <div className={`rounded-xl border p-6 sm:p-8 ${bgClass[b.data.bg]}`}>
      <BlockIcon name={b.styles?.icon} className={`mb-3 size-8 ${dark ? "text-white/80" : "text-primary"}`} />
      <div className="mb-2 flex gap-1">
        {HERO_BG.map((bg) => (
          <button
            key={bg}
            type="button"
            onClick={() => set({ bg })}
            title={bg}
            className={`size-4 rounded-full border ${b.data.bg === bg ? "ring-2 ring-primary" : ""} ${bgClass[bg]}`}
          />
        ))}
      </div>
      <input
        value={b.data.eyebrow}
        onChange={(e) => set({ eyebrow: e.target.value })}
        placeholder="Rótulo (opcional)"
        className={`block w-full bg-transparent text-xs font-semibold uppercase tracking-wide outline-none ${dark ? "text-white/70 placeholder:text-white/40" : "text-primary"}`}
      />
      <input
        value={b.data.title}
        onChange={(e) => set({ title: e.target.value })}
        placeholder="Título do banner"
        className="mt-1.5 block w-full bg-transparent text-2xl font-semibold leading-tight tracking-tight outline-none sm:text-3xl"
      />
      <input
        value={b.data.subtitle}
        onChange={(e) => set({ subtitle: e.target.value })}
        placeholder="Subtítulo (opcional)"
        className={`mt-2 block w-full bg-transparent outline-none ${dark ? "text-white/80 placeholder:text-white/40" : "text-text-muted"}`}
      />
    </div>
  );
}

export function SnippetBlock({ block, onChange }: BlockEditProps) {
  const b = block as Extract<Block, { type: "snippet" }>;
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface-2 p-3 text-sm">
      <span className="text-text-muted">Snippet reutilizável — chave: </span>
      <input
        value={b.data.snippetKey}
        onChange={(e) => onChange({ data: { snippetKey: e.target.value } } as Partial<Block>)}
        placeholder="chave-do-snippet"
        className="bg-transparent font-mono outline-none"
      />
    </div>
  );
}

export function AccordionItemBlock({ block, onChange, children }: BlockEditProps) {
  const b = block as Extract<Block, { type: "accordionItem" }>;
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="flex items-center gap-2 bg-surface-2 px-3">
        <BlockIcon name={b.styles?.icon} className="size-4 shrink-0 text-primary" />
        <input
          value={b.data.title}
          onChange={(e) => onChange({ data: { title: e.target.value } } as Partial<Block>)}
          placeholder="Título da seção"
          className="w-full bg-transparent py-2 text-sm font-medium outline-none"
        />
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

export function TabBlock({ block, onChange, children }: BlockEditProps) {
  const b = block as Extract<Block, { type: "tab" }>;
  return (
    <div className="rounded-md border border-border">
      <input
        value={b.data.label}
        onChange={(e) => onChange({ data: { label: e.target.value } } as Partial<Block>)}
        placeholder="Rótulo da aba"
        className="w-full border-b border-border bg-surface-2 px-3 py-1.5 text-sm font-medium outline-none"
      />
      <div className="p-3">{children}</div>
    </div>
  );
}

export function CardBlock({ block, onChange, children }: BlockEditProps) {
  const b = block as Extract<Block, { type: "card" }>;
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <BlockIcon name={b.styles?.icon ?? b.data.icon} className="mb-2 size-5 text-primary" />
      <input
        value={b.data.title}
        onChange={(e) => onChange({ data: { ...b.data, title: e.target.value } } as Partial<Block>)}
        placeholder="Título do card"
        className="mb-1 block w-full bg-transparent font-semibold outline-none"
      />
      <div className="text-sm text-text-muted">{children}</div>
      <input
        value={b.data.href}
        onChange={(e) => onChange({ data: { ...b.data, href: e.target.value } } as Partial<Block>)}
        placeholder="Link (opcional)"
        className="mt-2 block w-full bg-transparent text-xs text-text-muted outline-none"
      />
    </div>
  );
}

/**
 * Item de lista. O marcador (•/número) vem do `<li>` real (wrapper do
 * block-item) sob `.prose`, igual ao portal — não desenhamos bullet à mão.
 */
export function ListItemBlock({ block, onChange, children, ...rest }: BlockEditProps) {
  const b = block as Extract<Block, { type: "listItem" }>;
  return (
    <>
      <RichText
        value={b.text}
        onChange={(text: RT) => onChange({ text } as Partial<Block>)}
        placeholder="Item…"
        autoFocus={rest.autoFocus}
        onEnter={rest.onEnter}
        onEmptyBackspace={rest.onEmptyBackspace}
        registerHandle={rest.registerHandle}
      />
      {children}
    </>
  );
}
