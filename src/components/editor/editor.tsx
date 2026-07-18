"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Table,
  TableRow,
  TableCell,
  TableHeader,
} from "@tiptap/extension-table";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Callout,
  Steps,
  StepItem,
  Accordion,
  AccordionItem,
  Tabs,
  TabItem,
  FigureImage,
  Video,
  LinkCard,
  HtmlEmbed,
  Snippet,
} from "./nodes";
import { EditorToolbar } from "./toolbar";
import {
  saveArticle,
  publishNode,
  unpublishNode,
} from "@/app/(admin)/admin/(app)/conteudo/article-actions";

const lowlight = createLowlight(common);

type SaveState = "idle" | "saving" | "saved" | "error";

export function ArticleEditor({
  nodeId,
  spaceId,
  title,
  initialContent,
  initialStatus,
}: {
  nodeId: string;
  spaceId: string;
  title: string;
  initialContent: object;
  initialStatus: "draft" | "review" | "published";
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: "Escreva o conteúdo…" }),
      CodeBlockLowlight.configure({ lowlight }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Callout,
      Steps,
      StepItem,
      Accordion,
      AccordionItem,
      Tabs,
      TabItem,
      FigureImage,
      Video,
      LinkCard,
      HtmlEmbed,
      Snippet,
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class:
          "prose prose-neutral dark:prose-invert max-w-prose focus:outline-none min-h-[50vh]",
      },
    },
    onUpdate: ({ editor }) => scheduleSave(editor.getJSON()),
  });

  const scheduleSave = useCallback(
    (json: object) => {
      setSaveState("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        const res = await saveArticle(nodeId, json);
        setSaveState(res.ok ? "saved" : "error");
        if (!res.ok) setMsg(res.error);
      }, 800);
    },
    [nodeId],
  );

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function onPublishToggle() {
    const res =
      status === "published"
        ? await unpublishNode(nodeId)
        : await publishNode(nodeId);
    if (!res.ok) {
      setMsg(res.error);
      return;
    }
    setStatus(status === "published" ? "draft" : "published");
    setMsg(null);
    router.refresh();
  }

  async function uploadImage(file: File) {
    const supabase = createClient();
    const path = `${spaceId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("assets").upload(path, file);
    if (error) {
      setMsg(`Falha no upload: ${error.message}`);
      return null;
    }
    const { data } = supabase.storage.from("assets").getPublicUrl(path);
    return data.publicUrl;
  }

  if (!editor) return null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <span className="text-xs text-text-muted">
            {saveState === "saving"
              ? "Salvando…"
              : saveState === "saved"
                ? "Salvo"
                : saveState === "error"
                  ? "Erro ao salvar"
                  : status === "published"
                    ? "Publicado"
                    : "Rascunho"}
          </span>
        </div>
        <Button
          variant={status === "published" ? "secondary" : "primary"}
          onClick={onPublishToggle}
        >
          {status === "published" ? "Despublicar" : "Publicar"}
        </Button>
      </div>

      <EditorToolbar editor={editor} onUploadImage={uploadImage} />

      {msg && (
        <p className="mt-2 rounded-md bg-brand-pink-50 px-3 py-2 text-sm text-brand-pink-700 dark:bg-brand-pink-950/40 dark:text-brand-pink-300">
          {msg}
        </p>
      )}

      <div className="mt-4 flex-1 overflow-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
