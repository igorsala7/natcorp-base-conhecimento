"use client";

import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Link as LinkIcon,
  Highlighter,
  Heading2,
  Heading3,
  Keyboard,
} from "lucide-react";
import { cn } from "@/lib/utils";

function B({
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
        "flex size-8 items-center justify-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text [&_svg]:size-4",
        active && "bg-brand-purple-50 text-primary dark:bg-brand-purple-950/40",
      )}
    >
      {children}
    </button>
  );
}

/** Menu flutuante ao selecionar texto: formatação contextual. */
export function EditorBubbleMenu({ editor }: { editor: Editor }) {
  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: "top", offset: 8 }}
      shouldShow={({ state }) => {
        const { from, to } = state.selection;
        return (
          from !== to &&
          !editor.isActive("codeBlock") &&
          !editor.isActive("mermaid") &&
          !editor.isActive("htmlEmbed")
        );
      }}
      className="flex items-center gap-0.5 rounded-lg border border-border bg-bg p-1 shadow-xl"
    >
      <B title="Título 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 />
      </B>
      <B title="Título 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <Heading3 />
      </B>
      <span className="mx-0.5 h-5 w-px bg-border" />
      <B title="Negrito" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold />
      </B>
      <B title="Itálico" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic />
      </B>
      <B title="Tachado" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough />
      </B>
      <B title="Código" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}>
        <Code />
      </B>
      <B title="Realce" active={editor.isActive("highlight")} onClick={() => editor.chain().focus().toggleHighlight({ color: "#fde68a" }).run()}>
        <Highlighter />
      </B>
      <B title="Tecla (kbd)" active={editor.isActive("kbd")} onClick={() => editor.chain().focus().toggleMark("kbd").run()}>
        <Keyboard />
      </B>
      <B
        title="Link"
        active={editor.isActive("link")}
        onClick={() => {
          if (editor.isActive("link")) {
            editor.chain().focus().unsetLink().run();
            return;
          }
          const url = prompt("URL do link:");
          if (url) editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
        }}
      >
        <LinkIcon />
      </B>
    </BubbleMenu>
  );
}
