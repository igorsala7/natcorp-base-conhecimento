"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  Bold,
  ChevronDown,
  Code,
  Columns2,
  FileCode,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Info,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  ListTree,
  Minus,
  MousePointerClick,
  Palette,
  Plus,
  Puzzle,
  Quote,
  Rows3,
  Square,
  Strikethrough,
  Columns3,
  Table as TableIcon,
  Highlighter,
  Video as VideoIcon,
  Workflow,
  Link2,
  LayoutGrid,
  Megaphone,
  ListCollapse,
  StretchVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";

function Btn({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn(
        "flex size-8 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-2 hover:text-text [&_svg]:size-4",
        active && "bg-brand-purple-50 text-primary dark:bg-brand-purple-950/40",
      )}
    >
      {children}
    </button>
  );
}

const Sep = () => <span className="mx-1 h-5 w-px bg-border" />;

export function EditorToolbar({
  editor,
  onUploadImage,
}: {
  editor: Editor;
  onUploadImage: (file: File) => Promise<string | null>;
}) {
  const [insertOpen, setInsertOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!insertOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setInsertOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setInsertOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [insertOpen]);

  const insert = (content: object) => {
    editor.chain().focus().insertContent(content).run();
    setInsertOpen(false);
  };
  const pickImage = () => {
    setInsertOpen(false);
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const url = await onUploadImage(file);
      if (url)
        editor
          .chain()
          .focus()
          .insertContent({ type: "figureImage", attrs: { src: url, alt: file.name, caption: "" } })
          .run();
    };
    input.click();
  };

  const blocks: { icon: React.ComponentType<{ className?: string }>; label: string; run: () => void }[] = [
    { icon: Megaphone, label: "Banner / Hero", run: () => insert({ type: "hero", attrs: { eyebrow: "", title: "", subtitle: "", bg: "purple" } }) },
    { icon: LayoutGrid, label: "Grade de cards", run: () => insert({ type: "cardGrid", attrs: { cols: 3 }, content: [1, 2, 3].map(() => ({ type: "card", attrs: { icon: "book", title: "", href: "" }, content: [{ type: "paragraph" }] })) }) },
    { icon: ListCollapse, label: "Toggle (recolhível)", run: () => insert({ type: "toggle", attrs: { title: "" }, content: [{ type: "paragraph" }] }) },
    { icon: Info, label: "Callout", run: () => insert({ type: "callout", attrs: { variant: "info" }, content: [{ type: "paragraph" }] }) },
    { icon: ListTree, label: "Passo a passo", run: () => insert({ type: "steps", content: [{ type: "stepItem", content: [{ type: "paragraph" }] }] }) },
    { icon: Rows3, label: "Accordion", run: () => insert({ type: "accordion", content: [{ type: "accordionItem", attrs: { title: "Seção" }, content: [{ type: "paragraph" }] }] }) },
    { icon: Columns3, label: "Abas", run: () => insert({ type: "tabs", content: [{ type: "tabItem", attrs: { label: "Aba 1" }, content: [{ type: "paragraph" }] }, { type: "tabItem", attrs: { label: "Aba 2" }, content: [{ type: "paragraph" }] }] }) },
    { icon: TableIcon, label: "Tabela", run: () => { editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); setInsertOpen(false); } },
    { icon: ImageIcon, label: "Imagem", run: pickImage },
    { icon: VideoIcon, label: "Vídeo", run: () => { const url = prompt("URL do vídeo:"); if (url) { const provider = /youtu/.test(url) ? "youtube" : /vimeo/.test(url) ? "vimeo" : "upload"; insert({ type: "video", attrs: { provider, src: url } }); } else setInsertOpen(false); } },
    { icon: Square, label: "Painel", run: () => insert({ type: "panel", attrs: { bg: "purple" }, content: [{ type: "paragraph" }] }) },
    { icon: Columns2, label: "Colunas", run: () => insert({ type: "columns", content: [{ type: "column", content: [{ type: "paragraph" }] }, { type: "column", content: [{ type: "paragraph" }] }] }) },
    { icon: Workflow, label: "Fluxograma", run: () => insert({ type: "mermaid", attrs: { code: "flowchart TD\n  A[Início] --> B{Decisão}\n  B -->|Sim| C[Fim]\n  B -->|Não| A" } }) },
    { icon: MousePointerClick, label: "Botão / CTA", run: () => insert({ type: "buttonLink", attrs: { label: "Saiba mais", href: "", variant: "primary" } }) },
    { icon: Link2, label: "Card de link", run: () => insert({ type: "linkCard", attrs: { url: "", title: "", description: "" } }) },
    { icon: FileCode, label: "Embed HTML", run: () => insert({ type: "htmlEmbed", attrs: { html: "" } }) },
    { icon: Puzzle, label: "Snippet", run: () => insert({ type: "snippet", attrs: { snippetKey: "" } }) },
    { icon: StretchVertical, label: "Espaçador", run: () => insert({ type: "spacer", attrs: { size: "md" } }) },
    { icon: Minus, label: "Divisor", run: () => { editor.chain().focus().setHorizontalRule().run(); setInsertOpen(false); } },
  ];

  return (
    <div className="sticky top-0 z-10 mt-3 flex flex-wrap items-center gap-0.5 rounded-lg border border-border bg-surface/95 p-1 backdrop-blur">
      <Btn title="Negrito" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold /></Btn>
      <Btn title="Itálico" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic /></Btn>
      <Btn title="Tachado" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough /></Btn>
      <Btn title="Código inline" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}><Code /></Btn>
      <Sep />
      <Btn title="Título 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 /></Btn>
      <Btn title="Título 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 /></Btn>
      <Btn title="Título 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 /></Btn>
      <Sep />
      <Btn title="Lista" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List /></Btn>
      <Btn title="Lista numerada" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered /></Btn>
      <Btn title="Citação" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote /></Btn>
      <Btn title="Bloco de código" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}><FileCode /></Btn>
      <Sep />
      <Btn title="Realce" active={editor.isActive("highlight")} onClick={() => editor.chain().focus().toggleHighlight({ color: "#fde68a" }).run()}><Highlighter /></Btn>
      <label title="Cor do texto" className="flex size-8 cursor-pointer items-center justify-center rounded-md text-text-muted hover:bg-surface-2 [&_svg]:size-4">
        <Palette />
        <input type="color" className="sr-only" onChange={(e) => editor.chain().focus().setColor(e.target.value).run()} />
      </label>
      <Btn title="Link" active={editor.isActive("link")} onClick={() => { const url = prompt("URL do link:"); if (url) editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run(); }}><LinkIcon /></Btn>
      <Sep />

      {/* Inserir bloco (dropdown) */}
      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setInsertOpen((v) => !v)}
          aria-expanded={insertOpen}
          className="flex h-8 items-center gap-1 rounded-md px-2 text-sm font-medium text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
        >
          <Plus className="size-4" /> Inserir
          <ChevronDown className="size-3.5" />
        </button>
        {insertOpen && (
          <div className="absolute left-0 top-full z-30 mt-1 grid w-64 grid-cols-1 gap-0.5 rounded-xl border border-border bg-bg p-1.5 shadow-2xl">
            {blocks.map((b) => {
              const Icon = b.icon;
              return (
                <button
                  key={b.label}
                  type="button"
                  onClick={b.run}
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-2"
                >
                  <Icon className="size-4 text-text-muted" /> {b.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <span className="ml-auto hidden items-center gap-1 pr-1 text-xs text-text-muted sm:flex">
        Tecle <kbd className="rounded border border-border px-1">/</kbd> para blocos
      </span>
    </div>
  );
}
