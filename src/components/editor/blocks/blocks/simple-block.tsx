"use client";

import type { Block, RichText as RT } from "@/lib/blocks/schema";
import { RichText } from "../rich-text/rich-text";
import { BlockIcon } from "../block-icon";
import type { BlockEditProps } from "../edit-types";

export function DividerBlock() {
  return <hr className="my-2 border-border" />;
}

export function SpacerBlock({ block }: BlockEditProps) {
  const b = block as Extract<Block, { type: "spacer" }>;
  const h = b.data.size === "sm" ? "h-3" : b.data.size === "lg" ? "h-12" : "h-6";
  // A altura é escolhida no painel de propriedades.
  return (
    <div className={`flex items-center justify-center rounded border border-dashed border-border ${h}`}>
      <span className="text-[10px] uppercase tracking-wide text-text-muted/70">Espaçador</span>
    </div>
  );
}

export function ButtonBlock({ block, onChange }: BlockEditProps) {
  const b = block as Extract<Block, { type: "button" }>;
  return (
    /* Estilo e link vivem no painel de propriedades — aqui só o texto do botão,
       com o MESMO acabamento do portal (px-5 py-2.5, semibold). */
    <div className="rounded-lg border border-border p-3">
      <input
        value={b.data.label}
        onChange={(e) => onChange({ data: { ...b.data, label: e.target.value } } as Partial<Block>)}
        placeholder="Texto do botão"
        className={`rounded-md px-5 py-2.5 text-sm font-semibold shadow-1 outline-none ${
          b.data.variant === "secondary"
            ? "border border-brand-purple-200 bg-surface text-primary dark:border-brand-purple-800"
            : "bg-primary text-primary-fg placeholder:text-primary-fg/60"
        }`}
      />
    </div>
  );
}

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
      {/* A cor de fundo agora está no painel de propriedades. */}
      <BlockIcon name={b.styles?.icon} className={`mb-3 size-7 ${dark ? "text-white/80" : "text-primary"}`} />
      <input
        value={b.data.eyebrow}
        onChange={(e) => set({ eyebrow: e.target.value })}
        placeholder="Rótulo (opcional)"
        className={`block w-full bg-transparent text-[0.6875rem] font-semibold uppercase tracking-[0.08em] outline-none ${dark ? "text-white/70 placeholder:text-white/40" : "text-primary"}`}
      />
      {/* Mesmo tamanho do portal (--l-hero): o título do banner no canvas
          media 30px enquanto a leitura mostrava 16 — o editor mentia. */}
      <input
        value={b.data.title}
        onChange={(e) => set({ title: e.target.value })}
        placeholder="Título do banner"
        className="mt-1.5 block w-full bg-transparent text-[length:var(--l-hero,1rem)] font-semibold leading-tight tracking-tight outline-none sm:text-[length:var(--l-hero,1.125rem)]"
      />
      <input
        value={b.data.subtitle}
        onChange={(e) => set({ subtitle: e.target.value })}
        placeholder="Subtítulo (opcional)"
        className={`mt-2.5 block w-full bg-transparent outline-none ${dark ? "text-white/80 placeholder:text-white/40" : "text-text-muted"}`}
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
      {/* O link do card está no painel de propriedades. */}
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
