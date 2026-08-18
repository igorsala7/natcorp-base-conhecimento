"use client";

import { useRef, useState } from "react";
import {
  ArrowDown, ArrowUp, Bold, ChevronDown, Code2, Copy,
  Highlighter, Italic, Link2, Strikethrough, Trash2, X,
  type LucideIcon,
} from "lucide-react";
import type { Block, BlockStyles, Mark, StyleAlign, StyleFontSize } from "@/lib/blocks/schema";
import { BLOCKS } from "@/lib/blocks/registry.meta";
import { BlockPropertiesForm } from "./properties-panel";
import { ObjectProperties } from "./object-properties";
import { CollapseButton } from "@/components/ui/resizable-panel";
import { useDismiss } from "./use-dismiss";
import type { EditorActions } from "./edit-types";

const FONTS: StyleFontSize[] = ["xs", "sm", "base", "lg", "xl", "2xl", "3xl"];
const ALIGNS: StyleAlign[] = ["left", "center", "right"];
const ALIGN_LABEL: Record<StyleAlign, string> = { left: "Esq.", center: "Centro", right: "Dir." };

/** Tipos com texto próprio (mostram formatação). */
const TEXTO = new Set<Block["type"]>([
  "paragraph", "heading", "listItem", "quote",
  "callout", "panel", "card", "step", "toggle", "accordionItem", "tab", "hero",
]);

/**
 * Painel de propriedades do bloco — abre na LATERAL DIREITA ao selecionar um
 * objeto (substitui a antiga faixa embaixo do cartão e a barra superior). Reúne,
 * de cima para baixo: ações rápidas · Texto (formatação + transformar) ·
 * propriedades ESPECÍFICAS do objeto · layout e aparência.
 */
export function BlockInspector({
  block,
  actions,
  onFormat,
  onLink,
  onClose,
  onCollapse,
}: {
  block: Block;
  actions: EditorActions;
  onFormat: (mark: Mark["type"]) => void;
  onLink: () => void;
  onClose: () => void;
  /** Recolhe o painel num trilho fino (mantém a seleção). */
  onCollapse?: () => void;
}) {
  const Meta = BLOCKS[block.type];
  const temTexto = TEXTO.has(block.type);
  const styles = block.styles ?? {};

  // Patch de estilos com limpeza (mesma regra do BlockPropertiesForm: remove
  // chaves "default"/none/0/auto para o documento ficar enxuto).
  const setStyle = (patch: Partial<BlockStyles>) => {
    const next: BlockStyles = { ...styles, ...patch };
    (Object.keys(next) as (keyof BlockStyles)[]).forEach((k) => {
      const v = next[k];
      if (v === undefined || v === "none" || v === 0 || v === "auto") delete next[k];
    });
    actions.patch(block.id, { styles: Object.keys(next).length ? next : undefined } as Partial<Block>);
  };

  return (
    <aside className="slim-scroll h-full w-full overflow-y-auto rounded-xl border border-border bg-surface shadow-1">
      {/* Cabeçalho */}
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-surface/95 px-3 py-2.5 backdrop-blur">
        <Meta.icon className="size-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{Meta.label}</span>
        {onCollapse && <CollapseButton side="right" onClick={onCollapse} label="as propriedades" />}
        <button
          type="button"
          aria-label="Fechar propriedades"
          title="Fechar propriedades (desmarca o item)"
          onClick={onClose}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Ações rápidas do bloco */}
      <div className="flex items-center gap-0.5 border-b border-border px-3 py-2">
        <Act title="Mover para cima (⌥⇧↑)" icon={ArrowUp} onClick={() => actions.move(block.id, -1)} />
        <Act title="Mover para baixo (⌥⇧↓)" icon={ArrowDown} onClick={() => actions.move(block.id, 1)} />
        <Act title="Duplicar (⌘D)" icon={Copy} onClick={() => actions.duplicate(block.id)} />
        <span className="ml-auto" />
        <Act title="Excluir (⌘⇧⌫)" icon={Trash2} danger onClick={() => actions.remove(block.id)} />
      </div>

      <div className="space-y-5 p-3">
        {/* ── Transformar em (converte preservando o conteúdo) ───────────── */}
        <TransformarEm block={block} actions={actions} />

        {/* ── Texto ──────────────────────────────────────────────────────── */}
        {temTexto && (
          <Grupo title="Texto">
            <div className="flex flex-wrap gap-1">
              <Fmt title="Negrito (⌘B)" icon={Bold} onClick={() => onFormat("bold")} />
              <Fmt title="Itálico (⌘I)" icon={Italic} onClick={() => onFormat("italic")} />
              <Fmt title="Tachado (⌘⇧X)" icon={Strikethrough} onClick={() => onFormat("strike")} />
              <Fmt title="Código inline (⌘E)" icon={Code2} onClick={() => onFormat("code")} />
              <Fmt title="Marca-texto (⌘⇧H)" icon={Highlighter} onClick={() => onFormat("highlight")} />
              <Fmt title="Link (⌘K)" icon={Link2} onClick={onLink} />
            </div>
            <p className="text-2xs text-text-muted">Aplica-se ao trecho de texto selecionado.</p>

            <div className="pt-1">
              <span className="mb-1.5 block text-xs font-medium text-text-muted">Tamanho da fonte</span>
              <div className="flex flex-wrap gap-1">
                {FONTS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setStyle({ fontSize: f })}
                    className={`rounded-md border px-2 py-1 text-xs ${
                      styles.fontSize === f ? "border-primary text-primary" : "border-border text-text-muted hover:bg-surface-2"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="mb-1.5 block text-xs font-medium text-text-muted">Alinhamento</span>
              <div className="flex gap-1">
                {ALIGNS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setStyle({ align: a })}
                    className={`flex-1 rounded-md border px-2 py-1 text-xs ${
                      styles.align === a ? "border-primary text-primary" : "border-border text-text-muted hover:bg-surface-2"
                    }`}
                  >
                    {ALIGN_LABEL[a]}
                  </button>
                ))}
              </div>
            </div>
          </Grupo>
        )}

        {/* ── Específico do objeto ───────────────────────────────────────── */}
        <ObjectProperties block={block} actions={actions} />

        {/* ── Layout e aparência ─────────────────────────────────────────── */}
        <BlockPropertiesForm block={block} actions={actions} />
      </div>
    </aside>
  );
}

/**
 * "Transformar em": lista suspensa para trocar o TIPO do bloco preservando o
 * conteúdo. Só aparece em blocos que aceitam texto — os alvos vêm de
 * `transformableTo` (mídia/void têm `[]`, então nem renderiza).
 */
function TransformarEm({ block, actions }: { block: Block; actions: EditorActions }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, aberto, () => setAberto(false));

  const alvos = BLOCKS[block.type].transformableTo;
  if (!alvos.length) return null;
  const Atual = BLOCKS[block.type];

  return (
    <Grupo title="Transformar em">
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="flex w-full items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm transition-colors hover:bg-surface-2"
        >
          <Atual.icon className="size-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate text-left">{Atual.label}</span>
          <ChevronDown className={`size-4 shrink-0 text-text-muted transition-transform ${aberto ? "rotate-180" : ""}`} />
        </button>
        {aberto && (
          <div className="slim-scroll absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-surface p-1 shadow-2">
            {alvos.map((t) => {
              const M = BLOCKS[t];
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    actions.transform(block.id, t);
                    setAberto(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-surface-2"
                >
                  <M.icon className="size-4 shrink-0 text-text-muted" />
                  <span className="min-w-0 flex-1 truncate">{M.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Grupo>
  );
}

function Grupo({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h4 className="text-2xs font-semibold uppercase tracking-wide text-text-muted">{title}</h4>
      {children}
    </section>
  );
}

function Act({ title, icon: Icon, onClick, danger }: { title: string; icon: LucideIcon; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`flex size-7 items-center justify-center rounded-md transition-colors ${
        danger ? "text-text-muted hover:bg-danger-soft hover:text-danger" : "text-text-muted hover:bg-surface-2 hover:text-text"
      }`}
    >
      <Icon className="size-4" />
    </button>
  );
}

function Fmt({ title, icon: Icon, onClick, active }: { title: string; icon: LucideIcon; onClick: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      // Mantém a seleção do texto ao clicar (senão o mark não aplica).
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex size-8 items-center justify-center rounded-md border transition-colors ${
        active ? "border-primary text-primary" : "border-border text-text-muted hover:bg-surface-2 hover:text-text"
      }`}
    >
      <Icon className="size-4" />
    </button>
  );
}
