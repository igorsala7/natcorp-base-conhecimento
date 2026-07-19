"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewWrapper,
  NodeViewContent,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { useState } from "react";
import DOMPurify from "isomorphic-dompurify";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Info,
  OctagonAlert,
} from "lucide-react";
import { MermaidView } from "./mermaid-view";

/* ============================ CALLOUT ============================ */
const CALLOUT_VARIANTS = {
  info: { icon: Info, cls: "border-brand-blue-300 bg-brand-blue-50 dark:bg-brand-blue-950/30" },
  warning: { icon: AlertTriangle, cls: "border-brand-pink-300 bg-brand-pink-50 dark:bg-brand-pink-950/30" },
  success: { icon: CheckCircle2, cls: "border-brand-purple-300 bg-brand-purple-50 dark:bg-brand-purple-950/30" },
  danger: { icon: OctagonAlert, cls: "border-brand-pink-400 bg-brand-pink-100 dark:bg-brand-pink-950/40" },
} as const;

function CalloutView({ node, updateAttributes }: NodeViewProps) {
  const variant = (node.attrs.variant ?? "info") as keyof typeof CALLOUT_VARIANTS;
  const { icon: Icon, cls } = CALLOUT_VARIANTS[variant];
  return (
    <NodeViewWrapper
      className={`my-3 flex gap-3 rounded-lg border-l-4 p-3 ${cls}`}
    >
      <Icon className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <select
          contentEditable={false}
          value={variant}
          onChange={(e) => updateAttributes({ variant: e.target.value })}
          className="mb-1 rounded border border-border bg-surface px-1 text-xs text-text-muted"
        >
          <option value="info">Info</option>
          <option value="warning">Atenção</option>
          <option value="success">Sucesso</option>
          <option value="danger">Perigo</option>
        </select>
        <NodeViewContent />
      </div>
    </NodeViewWrapper>
  );
}

export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes() {
    return { variant: { default: "info" } };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "callout" }), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(CalloutView);
  },
});

/* ============================ STEPS ============================ */
function StepsView() {
  return (
    <NodeViewWrapper className="my-3">
      <NodeViewContent className="steps-list [counter-reset:step]" />
    </NodeViewWrapper>
  );
}
export const Steps = Node.create({
  name: "steps",
  group: "block",
  content: "stepItem+",
  parseHTML() {
    return [{ tag: 'div[data-type="steps"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "steps" }), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(StepsView);
  },
});
function StepItemView() {
  return (
    <NodeViewWrapper className="steps-item relative mb-3 border-l-2 border-border pl-8">
      <span
        contentEditable={false}
        className="absolute left-[-13px] top-0 flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-fg [counter-increment:step] before:content-[counter(step)]"
      />
      <NodeViewContent />
    </NodeViewWrapper>
  );
}
export const StepItem = Node.create({
  name: "stepItem",
  content: "block+",
  defining: true,
  parseHTML() {
    return [{ tag: 'div[data-type="step-item"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "step-item" }), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(StepItemView);
  },
});

/* ============================ ACCORDION ============================ */
function AccordionItemView({ node, updateAttributes }: NodeViewProps) {
  const [open, setOpen] = useState(true);
  return (
    <NodeViewWrapper className="mb-1 overflow-hidden rounded-md border border-border">
      <div className="flex items-center gap-2 bg-surface-2 px-3 py-2">
        <button
          type="button"
          contentEditable={false}
          onClick={() => setOpen((o) => !o)}
          className="text-text-muted"
        >
          <ChevronDown className={`size-4 transition ${open ? "" : "-rotate-90"}`} />
        </button>
        <input
          contentEditable={false}
          value={node.attrs.title ?? ""}
          onChange={(e) => updateAttributes({ title: e.target.value })}
          placeholder="Título da seção"
          className="flex-1 bg-transparent text-sm font-medium focus:outline-none"
        />
      </div>
      <div className={open ? "p-3" : "hidden"}>
        <NodeViewContent />
      </div>
    </NodeViewWrapper>
  );
}
export const AccordionItem = Node.create({
  name: "accordionItem",
  content: "block+",
  defining: true,
  addAttributes() {
    return { title: { default: "" } };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="accordion-item"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "accordion-item" }), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(AccordionItemView);
  },
});
function AccordionView() {
  return (
    <NodeViewWrapper className="my-3">
      <NodeViewContent />
    </NodeViewWrapper>
  );
}
export const Accordion = Node.create({
  name: "accordion",
  group: "block",
  content: "accordionItem+",
  parseHTML() {
    return [{ tag: 'div[data-type="accordion"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "accordion" }), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(AccordionView);
  },
});

/* ============================ TABS ============================ */
function TabsView({ node }: NodeViewProps) {
  const [active, setActive] = useState(0);
  const labels: string[] = [];
  node.forEach((child) => labels.push(child.attrs.label || "Aba"));
  return (
    <NodeViewWrapper className="my-3 rounded-lg border border-border">
      <div
        contentEditable={false}
        className="flex gap-1 border-b border-border bg-surface-2 p-1"
      >
        {labels.map((label, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActive(i)}
            className={`rounded px-3 py-1 text-sm ${
              i === active ? "bg-surface font-medium text-primary" : "text-text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <NodeViewContent className={`tabs-content show-${active} p-3`} />
    </NodeViewWrapper>
  );
}
export const Tabs = Node.create({
  name: "tabs",
  group: "block",
  content: "tabItem+",
  parseHTML() {
    return [{ tag: 'div[data-type="tabs"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "tabs" }), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(TabsView);
  },
});
function TabItemView({ node, updateAttributes }: NodeViewProps) {
  return (
    <NodeViewWrapper className="tab-item">
      <input
        contentEditable={false}
        value={node.attrs.label ?? ""}
        onChange={(e) => updateAttributes({ label: e.target.value })}
        placeholder="Rótulo da aba"
        className="mb-2 rounded border border-border bg-surface px-2 py-0.5 text-xs text-text-muted"
      />
      <NodeViewContent />
    </NodeViewWrapper>
  );
}
export const TabItem = Node.create({
  name: "tabItem",
  content: "block+",
  defining: true,
  addAttributes() {
    return { label: { default: "Aba" } };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="tab-item"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "tab-item" }), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(TabItemView);
  },
});

/* ======================= FIGURE IMAGE (com legenda) ======================= */
function FigureImageView({ node, updateAttributes }: NodeViewProps) {
  const { src, alt, caption } = node.attrs;
  return (
    <NodeViewWrapper className="my-4">
      <figure className="text-center">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt ?? ""} loading="lazy" decoding="async" className="mx-auto max-h-[480px] rounded-lg" />
        ) : (
          <div className="rounded-lg border border-dashed border-border p-8 text-sm text-text-muted">
            Imagem sem origem
          </div>
        )}
        <figcaption contentEditable={false}>
          <input
            value={caption ?? ""}
            onChange={(e) => updateAttributes({ caption: e.target.value })}
            placeholder="Legenda (opcional)"
            className="mt-2 w-full bg-transparent text-center text-sm text-text-muted focus:outline-none"
          />
        </figcaption>
      </figure>
    </NodeViewWrapper>
  );
}
export const FigureImage = Node.create({
  name: "figureImage",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return { src: { default: null }, alt: { default: "" }, caption: { default: "" } };
  },
  parseHTML() {
    return [{ tag: 'figure[data-type="figure-image"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "figure",
      mergeAttributes(HTMLAttributes, { "data-type": "figure-image" }),
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(FigureImageView);
  },
});

/* ============================ VIDEO ============================ */
function toEmbedUrl(provider: string, src: string) {
  if (provider === "youtube") {
    const id = src.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/)?.[1];
    return id ? `https://www.youtube.com/embed/${id}` : src;
  }
  if (provider === "vimeo") {
    const id = src.match(/vimeo\.com\/(\d+)/)?.[1];
    return id ? `https://player.vimeo.com/video/${id}` : src;
  }
  return src;
}
function VideoView({ node }: NodeViewProps) {
  const { provider, src } = node.attrs;
  if (provider === "upload") {
    return (
      <NodeViewWrapper className="my-4">
        <video src={src} controls className="mx-auto max-h-[480px] rounded-lg" />
      </NodeViewWrapper>
    );
  }
  return (
    <NodeViewWrapper className="my-4">
      <div className="relative aspect-video overflow-hidden rounded-lg">
        <iframe
          src={toEmbedUrl(provider, src ?? "")}
          className="absolute inset-0 size-full"
          allowFullScreen
          title="Vídeo"
        />
      </div>
    </NodeViewWrapper>
  );
}
export const Video = Node.create({
  name: "video",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return { provider: { default: "youtube" }, src: { default: "" } };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="video"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "video" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(VideoView);
  },
});

/* ============================ LINK CARD ============================ */
function LinkCardView({ node, updateAttributes }: NodeViewProps) {
  const { url, title, description } = node.attrs;
  return (
    <NodeViewWrapper className="my-3">
      <div className="rounded-lg border border-border p-4">
        <input
          contentEditable={false}
          value={title ?? ""}
          onChange={(e) => updateAttributes({ title: e.target.value })}
          placeholder="Título do card"
          className="w-full bg-transparent text-sm font-semibold focus:outline-none"
        />
        <input
          contentEditable={false}
          value={description ?? ""}
          onChange={(e) => updateAttributes({ description: e.target.value })}
          placeholder="Descrição"
          className="mt-1 w-full bg-transparent text-sm text-text-muted focus:outline-none"
        />
        <input
          contentEditable={false}
          value={url ?? ""}
          onChange={(e) => updateAttributes({ url: e.target.value })}
          placeholder="https://…"
          className="mt-1 w-full bg-transparent text-xs text-primary focus:outline-none"
        />
      </div>
    </NodeViewWrapper>
  );
}
export const LinkCard = Node.create({
  name: "linkCard",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return { url: { default: "" }, title: { default: "" }, description: { default: "" } };
  },
  parseHTML() {
    return [{ tag: 'a[data-type="link-card"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["a", mergeAttributes(HTMLAttributes, { "data-type": "link-card" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(LinkCardView);
  },
});

/* ======================= HTML EMBED (sanitizado) ======================= */
function HtmlEmbedView({ node, updateAttributes }: NodeViewProps) {
  const [editing, setEditing] = useState(!node.attrs.html);
  const clean = DOMPurify.sanitize(node.attrs.html ?? "");
  return (
    <NodeViewWrapper className="my-3">
      <div className="rounded-lg border border-border">
        <div
          contentEditable={false}
          className="flex items-center justify-between border-b border-border bg-surface-2 px-3 py-1 text-xs text-text-muted"
        >
          <span>Embed HTML (sanitizado)</span>
          <button type="button" onClick={() => setEditing((e) => !e)} className="text-primary">
            {editing ? "Pré-visualizar" : "Editar"}
          </button>
        </div>
        {editing ? (
          <textarea
            contentEditable={false}
            value={node.attrs.html ?? ""}
            onChange={(e) => updateAttributes({ html: e.target.value })}
            placeholder="<iframe …></iframe>"
            className="h-28 w-full resize-y bg-surface p-3 font-mono text-xs focus:outline-none"
          />
        ) : (
          <div
            contentEditable={false}
            className="p-3"
            dangerouslySetInnerHTML={{ __html: clean }}
          />
        )}
      </div>
    </NodeViewWrapper>
  );
}
export const HtmlEmbed = Node.create({
  name: "htmlEmbed",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return { html: { default: "" } };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="html-embed"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "html-embed" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(HtmlEmbedView);
  },
});

/* ======================= SNIPPET (transclusão) ======================= */
function SnippetView({ node, updateAttributes }: NodeViewProps) {
  return (
    <NodeViewWrapper className="my-3">
      <div className="rounded-lg border border-dashed border-brand-purple-300 bg-brand-purple-50 p-3 dark:bg-brand-purple-950/30">
        <div contentEditable={false} className="flex items-center gap-2 text-sm">
          <span className="font-medium text-primary">Snippet reutilizável</span>
          <input
            value={node.attrs.snippetKey ?? ""}
            onChange={(e) => updateAttributes({ snippetKey: e.target.value })}
            placeholder="chave-do-snippet"
            className="rounded border border-border bg-surface px-2 py-0.5 font-mono text-xs"
          />
        </div>
        <p contentEditable={false} className="mt-1 text-xs text-text-muted">
          O conteúdo é transcluído na publicação — editar o snippet atualiza todos os usos.
        </p>
      </div>
    </NodeViewWrapper>
  );
}
export const Snippet = Node.create({
  name: "snippet",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return { snippetKey: { default: "" } };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="snippet"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "snippet" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(SnippetView);
  },
});

/* ============================ PAINEL (caixa com fundo) ============================ */
const PANEL_BG: Record<string, string> = {
  purple: "bg-brand-purple-50 dark:bg-brand-purple-950/30",
  pink: "bg-brand-pink-50 dark:bg-brand-pink-950/30",
  blue: "bg-brand-blue-50 dark:bg-brand-blue-950/30",
  gray: "bg-brand-gray-100 dark:bg-brand-gray-800",
};
function PanelView({ node, updateAttributes }: NodeViewProps) {
  const bg = (node.attrs.bg ?? "purple") as string;
  return (
    <NodeViewWrapper className={`my-4 rounded-xl p-5 ${PANEL_BG[bg] ?? PANEL_BG.purple}`}>
      <select
        contentEditable={false}
        value={bg}
        onChange={(e) => updateAttributes({ bg: e.target.value })}
        className="mb-2 rounded border border-border bg-surface px-1 text-xs text-text-muted"
      >
        <option value="purple">Fundo roxo</option>
        <option value="pink">Fundo rosa</option>
        <option value="blue">Fundo azul</option>
        <option value="gray">Fundo cinza</option>
      </select>
      <div className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
        <NodeViewContent />
      </div>
    </NodeViewWrapper>
  );
}
export const Panel = Node.create({
  name: "panel",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes() {
    return { bg: { default: "purple" } };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="panel"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "panel" }), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(PanelView);
  },
});

/* ============================ COLUNAS ============================ */
function ColumnsView() {
  return (
    <NodeViewWrapper className="my-4">
      <NodeViewContent className="grid gap-4 md:grid-cols-2 [&>.column]:min-w-0" />
    </NodeViewWrapper>
  );
}
export const Columns = Node.create({
  name: "columns",
  group: "block",
  content: "column+",
  parseHTML() {
    return [{ tag: 'div[data-type="columns"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "columns" }), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ColumnsView);
  },
});
function ColumnView() {
  return (
    <NodeViewWrapper className="column rounded-lg border border-dashed border-border p-3 [&>*:first-child]:mt-0">
      <NodeViewContent />
    </NodeViewWrapper>
  );
}
export const Column = Node.create({
  name: "column",
  content: "block+",
  defining: true,
  parseHTML() {
    return [{ tag: 'div[data-type="column"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "column" }), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ColumnView);
  },
});

/* ============================ MERMAID (fluxograma/gráfico) ============================ */
function MermaidNodeView({ node, updateAttributes }: NodeViewProps) {
  const [editing, setEditing] = useState(!node.attrs.code);
  const code = (node.attrs.code ?? "") as string;
  return (
    <NodeViewWrapper className="my-4">
      <div className="rounded-lg border border-border">
        <div
          contentEditable={false}
          className="flex items-center justify-between border-b border-border bg-surface-2 px-3 py-1 text-xs text-text-muted"
        >
          <span>Diagrama (Mermaid)</span>
          <button type="button" className="text-primary" onClick={() => setEditing((e) => !e)}>
            {editing ? "Pré-visualizar" : "Editar"}
          </button>
        </div>
        {editing ? (
          <textarea
            contentEditable={false}
            value={code}
            onChange={(e) => updateAttributes({ code: e.target.value })}
            placeholder={"flowchart TD\n  A[Início] --> B{Decisão}\n  B -->|Sim| C[Fim]\n  B -->|Não| A"}
            className="h-40 w-full resize-y bg-surface p-3 font-mono text-xs focus:outline-none"
          />
        ) : (
          <div contentEditable={false}>
            <MermaidView code={code} />
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}
export const Mermaid = Node.create({
  name: "mermaid",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return { code: { default: "" } };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="mermaid"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "mermaid" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(MermaidNodeView);
  },
});

/* ============================ BOTÃO / CTA ============================ */
function ButtonLinkView({ node, updateAttributes }: NodeViewProps) {
  const { label, href, variant } = node.attrs as {
    label: string;
    href: string;
    variant: string;
  };
  return (
    <NodeViewWrapper className="my-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border p-3">
        <span
          className={
            variant === "secondary"
              ? "inline-flex items-center rounded-md border border-border bg-surface-2 px-4 py-2 text-sm font-medium"
              : "inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-fg"
          }
        >
          {label || "Botão"}
        </span>
        <input
          contentEditable={false}
          value={label}
          onChange={(e) => updateAttributes({ label: e.target.value })}
          placeholder="Rótulo"
          className="rounded border border-border bg-surface px-2 py-1 text-xs"
        />
        <input
          contentEditable={false}
          value={href}
          onChange={(e) => updateAttributes({ href: e.target.value })}
          placeholder="https://…"
          className="flex-1 rounded border border-border bg-surface px-2 py-1 text-xs"
        />
        <select
          contentEditable={false}
          value={variant}
          onChange={(e) => updateAttributes({ variant: e.target.value })}
          className="rounded border border-border bg-surface px-1 text-xs"
        >
          <option value="primary">Primário</option>
          <option value="secondary">Secundário</option>
        </select>
      </div>
    </NodeViewWrapper>
  );
}
export const ButtonLink = Node.create({
  name: "buttonLink",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return { label: { default: "Saiba mais" }, href: { default: "" }, variant: { default: "primary" } };
  },
  parseHTML() {
    return [{ tag: 'a[data-type="button-link"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["a", mergeAttributes(HTMLAttributes, { "data-type": "button-link" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ButtonLinkView);
  },
});
