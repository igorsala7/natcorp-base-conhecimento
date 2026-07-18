"use client";

import { useRef } from "react";
import type { Editor } from "@tiptap/react";
import {
  Bold,
  Code,
  Code2,
  Columns3,
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
  Puzzle,
  Quote,
  Rows3,
  Strikethrough,
  Table as TableIcon,
  Video as VideoIcon,
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
      onClick={onClick}
      className={cn(
        "flex size-8 items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text [&_svg]:size-4",
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
  const fileRef = useRef<HTMLInputElement>(null);

  const insert = (content: object) =>
    editor.chain().focus().insertContent(content).run();

  return (
    <div className="mt-3 flex flex-wrap items-center gap-0.5 rounded-lg border border-border bg-surface p-1">
      <Btn title="Negrito" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold />
      </Btn>
      <Btn title="Itálico" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic />
      </Btn>
      <Btn title="Tachado" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough />
      </Btn>
      <Btn title="Código inline" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}>
        <Code />
      </Btn>
      <Sep />
      <Btn title="Título 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        <Heading1 />
      </Btn>
      <Btn title="Título 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 />
      </Btn>
      <Btn title="Título 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <Heading3 />
      </Btn>
      <Sep />
      <Btn title="Lista" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List />
      </Btn>
      <Btn title="Lista numerada" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered />
      </Btn>
      <Btn title="Citação" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote />
      </Btn>
      <Btn title="Bloco de código" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        <FileCode />
      </Btn>
      <Btn
        title="Link"
        active={editor.isActive("link")}
        onClick={() => {
          const url = prompt("URL do link:");
          if (url) editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
        }}
      >
        <LinkIcon />
      </Btn>
      <Sep />
      <Btn title="Callout" onClick={() => insert({ type: "callout", attrs: { variant: "info" }, content: [{ type: "paragraph" }] })}>
        <Info />
      </Btn>
      <Btn title="Passo a passo" onClick={() => insert({ type: "steps", content: [{ type: "stepItem", content: [{ type: "paragraph" }] }] })}>
        <ListTree />
      </Btn>
      <Btn title="Accordion" onClick={() => insert({ type: "accordion", content: [{ type: "accordionItem", attrs: { title: "Seção" }, content: [{ type: "paragraph" }] }] })}>
        <Rows3 />
      </Btn>
      <Btn title="Abas" onClick={() => insert({ type: "tabs", content: [{ type: "tabItem", attrs: { label: "Aba 1" }, content: [{ type: "paragraph" }] }, { type: "tabItem", attrs: { label: "Aba 2" }, content: [{ type: "paragraph" }] }] })}>
        <Columns3 />
      </Btn>
      <Btn title="Tabela" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
        <TableIcon />
      </Btn>
      <Sep />
      <Btn title="Imagem (upload)" onClick={() => fileRef.current?.click()}>
        <ImageIcon />
      </Btn>
      <Btn
        title="Vídeo"
        onClick={() => {
          const url = prompt("URL do vídeo (YouTube, Vimeo ou arquivo):");
          if (!url) return;
          const provider = /youtu/.test(url) ? "youtube" : /vimeo/.test(url) ? "vimeo" : "upload";
          insert({ type: "video", attrs: { provider, src: url } });
        }}
      >
        <VideoIcon />
      </Btn>
      <Btn title="Card de link" onClick={() => insert({ type: "linkCard", attrs: { url: "", title: "", description: "" } })}>
        <Code2 />
      </Btn>
      <Btn title="Embed HTML" onClick={() => insert({ type: "htmlEmbed", attrs: { html: "" } })}>
        <FileCode />
      </Btn>
      <Btn title="Snippet reutilizável" onClick={() => insert({ type: "snippet", attrs: { snippetKey: "" } })}>
        <Puzzle />
      </Btn>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const url = await onUploadImage(file);
          if (url) insert({ type: "figureImage", attrs: { src: url, alt: file.name, caption: "" } });
          e.target.value = "";
        }}
      />
    </div>
  );
}
