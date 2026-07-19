"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  type ComponentType,
} from "react";
import { Extension, type Range } from "@tiptap/core";
import type { Editor } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import {
  Type,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  FileCode,
  Minus,
  Info,
  ListTree,
  Rows3,
  Columns3,
  Table as TableIcon,
  Image as ImageIcon,
  Video as VideoIcon,
  Square,
  Columns2,
  Workflow,
  MousePointerClick,
  Puzzle,
  Link2,
  LayoutGrid,
  Megaphone,
  ListCollapse,
  StretchVertical,
} from "lucide-react";

type Cmd = (opts: { editor: Editor; range: Range }) => void;
export type SlashItem = {
  title: string;
  subtitle: string;
  icon: ComponentType<{ className?: string }>;
  keywords: string;
  command: Cmd;
};

/** Insere `content` no lugar da consulta "/…". */
const replace = (content: object) => (({ editor, range }: { editor: Editor; range: Range }) =>
  editor.chain().focus().deleteRange(range).insertContent(content).run()) as Cmd;

function buildItems(onImage: () => void): SlashItem[] {
  return [
    {
      title: "Texto",
      subtitle: "Parágrafo simples",
      icon: Type,
      keywords: "texto paragrafo p body",
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setParagraph().run(),
    },
    {
      title: "Título 1",
      subtitle: "Seção principal",
      icon: Heading1,
      keywords: "titulo h1 heading",
      command: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run(),
    },
    {
      title: "Título 2",
      subtitle: "Subseção",
      icon: Heading2,
      keywords: "titulo h2 heading",
      command: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run(),
    },
    {
      title: "Título 3",
      subtitle: "Subtítulo",
      icon: Heading3,
      keywords: "titulo h3 heading",
      command: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).setNode("heading", { level: 3 }).run(),
    },
    {
      title: "Lista com marcadores",
      subtitle: "Lista não ordenada",
      icon: List,
      keywords: "lista bullet marcador ul",
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
    },
    {
      title: "Lista numerada",
      subtitle: "Lista ordenada",
      icon: ListOrdered,
      keywords: "lista numerada ordenada ol",
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
    },
    {
      title: "Citação",
      subtitle: "Bloco de destaque",
      icon: Quote,
      keywords: "citacao quote blockquote",
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
    },
    {
      title: "Bloco de código",
      subtitle: "Código com realce",
      icon: FileCode,
      keywords: "codigo code bloco pre",
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
    },
    {
      title: "Divisor",
      subtitle: "Linha horizontal",
      icon: Minus,
      keywords: "divisor linha hr separador",
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
    },
    {
      title: "Callout",
      subtitle: "Aviso / destaque",
      icon: Info,
      keywords: "callout aviso nota atencao admonition",
      command: replace({ type: "callout", attrs: { variant: "info" }, content: [{ type: "paragraph" }] }),
    },
    {
      title: "Passo a passo",
      subtitle: "Lista de etapas",
      icon: ListTree,
      keywords: "passos etapas steps tutorial",
      command: replace({ type: "steps", content: [{ type: "stepItem", content: [{ type: "paragraph" }] }] }),
    },
    {
      title: "Accordion",
      subtitle: "Seções recolhíveis",
      icon: Rows3,
      keywords: "accordion sanfona recolher faq",
      command: replace({
        type: "accordion",
        content: [{ type: "accordionItem", attrs: { title: "Seção" }, content: [{ type: "paragraph" }] }],
      }),
    },
    {
      title: "Abas",
      subtitle: "Conteúdo em abas",
      icon: Columns3,
      keywords: "abas tabs",
      command: replace({
        type: "tabs",
        content: [
          { type: "tabItem", attrs: { label: "Aba 1" }, content: [{ type: "paragraph" }] },
          { type: "tabItem", attrs: { label: "Aba 2" }, content: [{ type: "paragraph" }] },
        ],
      }),
    },
    {
      title: "Tabela",
      subtitle: "Tabela 3×3",
      icon: TableIcon,
      keywords: "tabela table grade",
      command: ({ editor, range }) =>
        editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    },
    {
      title: "Imagem",
      subtitle: "Enviar do computador",
      icon: ImageIcon,
      keywords: "imagem foto image upload",
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        onImage();
      },
    },
    {
      title: "Vídeo",
      subtitle: "YouTube, Vimeo ou upload",
      icon: VideoIcon,
      keywords: "video youtube vimeo",
      command: ({ editor, range }) => {
        const url = prompt("URL do vídeo:");
        editor.chain().focus().deleteRange(range).run();
        if (url) {
          const provider = /youtu/.test(url) ? "youtube" : /vimeo/.test(url) ? "vimeo" : "upload";
          editor.chain().focus().insertContent({ type: "video", attrs: { provider, src: url } }).run();
        }
      },
    },
    {
      title: "Painel",
      subtitle: "Caixa com fundo colorido",
      icon: Square,
      keywords: "painel panel caixa destaque fundo",
      command: replace({ type: "panel", attrs: { bg: "purple" }, content: [{ type: "paragraph" }] }),
    },
    {
      title: "Colunas",
      subtitle: "Layout em 2 colunas",
      icon: Columns2,
      keywords: "colunas columns lado",
      command: replace({
        type: "columns",
        content: [
          { type: "column", content: [{ type: "paragraph" }] },
          { type: "column", content: [{ type: "paragraph" }] },
        ],
      }),
    },
    {
      title: "Fluxograma",
      subtitle: "Diagrama Mermaid",
      icon: Workflow,
      keywords: "fluxograma diagrama mermaid grafico chart",
      command: replace({
        type: "mermaid",
        attrs: { code: "flowchart TD\n  A[Início] --> B{Decisão}\n  B -->|Sim| C[Fim]\n  B -->|Não| A" },
      }),
    },
    {
      title: "Botão / CTA",
      subtitle: "Link estilizado",
      icon: MousePointerClick,
      keywords: "botao cta button link",
      command: replace({ type: "buttonLink", attrs: { label: "Saiba mais", href: "", variant: "primary" } }),
    },
    {
      title: "Card de link",
      subtitle: "Prévia de link",
      icon: Link2,
      keywords: "card link preview",
      command: replace({ type: "linkCard", attrs: { url: "", title: "", description: "" } }),
    },
    {
      title: "Snippet reutilizável",
      subtitle: "Conteúdo transcluído",
      icon: Puzzle,
      keywords: "snippet reutilizavel transclusao",
      command: replace({ type: "snippet", attrs: { snippetKey: "" } }),
    },
    {
      title: "Banner / Hero",
      subtitle: "Cabeçalho de destaque",
      icon: Megaphone,
      keywords: "banner hero cabecalho destaque capa",
      command: replace({ type: "hero", attrs: { eyebrow: "", title: "", subtitle: "", bg: "purple" } }),
    },
    {
      title: "Grade de cards",
      subtitle: "Cards com ícone e título",
      icon: LayoutGrid,
      keywords: "cards grade grid cartoes navegacao",
      command: replace({
        type: "cardGrid",
        attrs: { cols: 3 },
        content: [1, 2, 3].map(() => ({
          type: "card",
          attrs: { icon: "book", title: "", href: "" },
          content: [{ type: "paragraph" }],
        })),
      }),
    },
    {
      title: "Toggle (recolhível)",
      subtitle: "Bloco que expande/recolhe",
      icon: ListCollapse,
      keywords: "toggle recolhivel detalhes expandir esconder",
      command: replace({ type: "toggle", attrs: { title: "" }, content: [{ type: "paragraph" }] }),
    },
    {
      title: "Espaçador",
      subtitle: "Espaço vertical",
      icon: StretchVertical,
      keywords: "espaco espacador spacer vazio",
      command: replace({ type: "spacer", attrs: { size: "md" } }),
    },
  ];
}

type MenuProps = { items: SlashItem[]; command: (item: SlashItem) => void };
type MenuRef = { onKeyDown: (p: { event: KeyboardEvent }) => boolean };

const SlashMenu = forwardRef<MenuRef, MenuProps>(function SlashMenu({ items, command }, ref) {
  const [sel, setSel] = useState(0);
  useEffect(() => setSel(0), [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowDown") {
        setSel((s) => (s + 1) % Math.max(items.length, 1));
        return true;
      }
      if (event.key === "ArrowUp") {
        setSel((s) => (s - 1 + items.length) % Math.max(items.length, 1));
        return true;
      }
      if (event.key === "Enter") {
        if (items[sel]) command(items[sel]!);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div className="w-72 rounded-xl border border-border bg-bg p-3 text-sm text-text-muted shadow-2xl">
        Nenhum bloco encontrado.
      </div>
    );
  }

  return (
    <div className="max-h-80 w-72 overflow-auto rounded-xl border border-border bg-bg p-1.5 shadow-2xl">
      {items.map((it, i) => {
        const Icon = it.icon;
        return (
          <button
            key={it.title}
            type="button"
            onMouseEnter={() => setSel(i)}
            onClick={() => command(it)}
            className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left ${
              i === sel ? "bg-brand-purple-50 dark:bg-brand-purple-950/40" : ""
            }`}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-text-muted">
              <Icon className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{it.title}</span>
              <span className="block truncate text-xs text-text-muted">{it.subtitle}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
});

function place(el: HTMLElement, rect: (() => DOMRect | null) | null | undefined) {
  const r = rect?.();
  if (!r) return;
  el.style.left = `${r.left}px`;
  el.style.top = `${r.bottom + 6 + window.scrollY}px`;
  // Evita sair pela borda inferior.
  const menuH = el.firstElementChild?.getBoundingClientRect().height ?? 0;
  if (r.bottom + menuH + 12 > window.innerHeight) {
    el.style.top = `${r.top - menuH - 6 + window.scrollY}px`;
  }
}

/** Extensão de slash command (/) — insere blocos por um menu pesquisável. */
export function createSlashCommand(onImage: () => void) {
  const ITEMS = buildItems(onImage);
  return Extension.create({
    name: "slashCommand",
    addProseMirrorPlugins() {
      return [
        Suggestion<SlashItem>({
          editor: this.editor,
          char: "/",
          allowSpaces: false,
          startOfLine: false,
          command: ({ editor, range, props }) => props.command({ editor, range }),
          items: ({ query }) => {
            const q = query.toLowerCase();
            return ITEMS.filter((it) =>
              (it.title + " " + it.keywords).toLowerCase().includes(q),
            ).slice(0, 10);
          },
          render: () => {
            let component: ReactRenderer<MenuRef, MenuProps> | null = null;
            let el: HTMLElement | null = null;
            return {
              onStart: (props) => {
                component = new ReactRenderer(SlashMenu, {
                  props: { items: props.items, command: props.command },
                  editor: props.editor,
                });
                el = document.createElement("div");
                el.style.position = "absolute";
                el.style.zIndex = "60";
                el.appendChild(component.element);
                document.body.appendChild(el);
                place(el, props.clientRect);
              },
              onUpdate: (props) => {
                component?.updateProps({ items: props.items, command: props.command });
                place(el!, props.clientRect);
              },
              onKeyDown: (props) => {
                if (props.event.key === "Escape") {
                  el?.remove();
                  return true;
                }
                return component?.ref?.onKeyDown(props) ?? false;
              },
              onExit: () => {
                el?.remove();
                el = null;
                component?.destroy();
                component = null;
              },
            };
          },
        }),
      ];
    },
  });
}
