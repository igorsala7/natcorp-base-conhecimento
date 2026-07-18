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
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Highlight } from "@tiptap/extension-highlight";
import { common, createLowlight } from "lowlight";
import { Check, Copy, ExternalLink, Maximize2, Minimize2 } from "lucide-react";
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
  Panel,
  Columns,
  Column,
  Mermaid,
  ButtonLink,
} from "./nodes";
import { EditorToolbar } from "./toolbar";
import {
  saveArticle,
  publishNode,
  unpublishNode,
  improveArticleLayout,
  reindexArticleEmbeddings,
} from "@/app/(admin)/admin/(app)/conteudo/article-actions";

const lowlight = createLowlight(common);

/** Extensões compartilhadas entre o editor principal e o preview de diff. */
const EDITOR_EXTENSIONS = [
  StarterKit.configure({ codeBlock: false }),
  Link.configure({ openOnClick: false }),
  Placeholder.configure({ placeholder: "Escreva o conteúdo…" }),
  CodeBlockLowlight.configure({ lowlight }),
  TextStyle,
  Color,
  Highlight.configure({ multicolor: true }),
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
  Panel,
  Columns,
  Column,
  Mermaid,
  ButtonLink,
];

type SaveState = "idle" | "saving" | "saved" | "error";

export function ArticleEditor({
  nodeId,
  spaceId,
  title,
  initialContent,
  initialStatus,
  publicUrl,
  spacePublic,
}: {
  nodeId: string;
  spaceId: string;
  title: string;
  initialContent: object;
  initialStatus: "draft" | "review" | "published";
  publicUrl?: string;
  spacePublic?: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [improving, setImproving] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const proposedRef = useRef<object | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: EDITOR_EXTENSIONS,
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

  // Editor read-only só para pré-visualizar a formatação proposta pela IA.
  const previewEditor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: EDITOR_EXTENSIONS,
    content: { type: "doc", content: [] },
    editorProps: {
      attributes: { class: "prose prose-neutral dark:prose-invert max-w-none" },
    },
  });

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function onImprove() {
    setImproving(true);
    setMsg(null);
    const res = await improveArticleLayout(nodeId);
    setImproving(false);
    if (!res.ok) {
      setMsg(res.error);
      return;
    }
    proposedRef.current = res.doc;
    previewEditor?.commands.setContent(res.doc as never);
    setShowDiff(true);
  }

  function applyImprove() {
    if (proposedRef.current && editor) {
      editor.commands.setContent(proposedRef.current as never);
      scheduleSave(editor.getJSON());
    }
    setShowDiff(false);
  }

  async function onReindex() {
    setReindexing(true);
    setMsg(null);
    const res = await reindexArticleEmbeddings(nodeId);
    setReindexing(false);
    setMsg(res.ok ? "Embeddings gerados — o assistente já usa este artigo na busca semântica." : res.error);
  }

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
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-40 flex flex-col overflow-hidden bg-bg p-4 md:p-8"
          : "flex h-full flex-col"
      }
    >
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
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
          {publicUrl && (
            <div className="mt-1 flex items-center gap-1 text-xs">
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                title="Abrir a página pública"
                className="flex max-w-[380px] items-center gap-1 truncate text-text-muted hover:text-primary"
              >
                <ExternalLink className="size-3 shrink-0" />
                <span className="truncate">{publicUrl.replace(/^https?:\/\//, "")}</span>
              </a>
              <button
                type="button"
                title="Copiar link público"
                onClick={() => {
                  navigator.clipboard.writeText(publicUrl);
                  setLinkCopied(true);
                  setTimeout(() => setLinkCopied(false), 1500);
                }}
                className="rounded p-0.5 text-text-muted hover:bg-surface-2 hover:text-text"
              >
                {linkCopied ? <Check className="size-3 text-primary" /> : <Copy className="size-3" />}
              </button>
              {(status !== "published" || !spacePublic) && (
                <span
                  className="text-brand-pink-700"
                  title={
                    status !== "published"
                      ? "Publique o artigo para o link ficar ativo"
                      : "O espaço não é público — o link só abre quando o espaço for público"
                  }
                >
                  • {status !== "published" ? "rascunho" : "espaço privado"}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            title={fullscreen ? "Sair da tela cheia" : "Expandir (tela cheia)"}
            onClick={() => setFullscreen((f) => !f)}
          >
            {fullscreen ? <Minimize2 /> : <Maximize2 />}
          </Button>
          <Button variant="ghost" size="sm" onClick={onReindex} disabled={reindexing} title="Gerar embeddings para a busca semântica sem despublicar">
            {reindexing ? "Gerando…" : "Gerar embeddings"}
          </Button>
          <Button variant="secondary" onClick={onImprove} disabled={improving}>
            {improving ? "Melhorando…" : "Melhorar layout (IA)"}
          </Button>
          <Button
            variant={status === "published" ? "secondary" : "primary"}
            onClick={onPublishToggle}
          >
            {status === "published" ? "Despublicar" : "Publicar"}
          </Button>
        </div>
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

      {showDiff && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
          onClick={() => setShowDiff(false)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div>
                <h2 className="font-semibold">Nova formatação proposta pela IA</h2>
                <p className="text-xs text-text-muted">
                  A IA reformata sem reescrever. Revise antes de aplicar (dá para
                  desfazer com Ctrl+Z).
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowDiff(false)}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={applyImprove}>
                  Aplicar
                </Button>
              </div>
            </div>
            <div className="overflow-auto p-5">
              <EditorContent editor={previewEditor} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
