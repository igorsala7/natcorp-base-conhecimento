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
import GlobalDragHandle from "tiptap-extension-global-drag-handle";
import {
  Check,
  Copy,
  ExternalLink,
  History,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Sparkles,
  Wand2,
} from "lucide-react";
import { createSlashCommand } from "./slash-command";
import { EditorBubbleMenu } from "./bubble-menu";
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
  CardGrid,
  Card,
  Toggle,
  Hero,
  Spacer,
  Kbd,
} from "./nodes";
import { EditorToolbar } from "./toolbar";
import { HistoryPanel } from "./history-panel";
import { ReviewThread } from "./review-thread";
import {
  submitForReview,
  approveReview,
  rejectReview,
} from "@/app/(admin)/admin/(app)/conteudo/review-actions";
import {
  saveArticle,
  publishNode,
  unpublishNode,
  improveArticleLayout,
  reindexArticleEmbeddings,
} from "@/app/(admin)/admin/(app)/conteudo/article-actions";

const lowlight = createLowlight(common);

function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Extensões compartilhadas entre o editor principal e o preview de diff. */
const EDITOR_EXTENSIONS = [
  StarterKit.configure({ codeBlock: false }),
  Link.configure({ openOnClick: false }),
  Placeholder.configure({
    placeholder: ({ node }) =>
      node.type.name === "paragraph"
        ? "Escreva, ou tecle “/” para inserir blocos…"
        : "",
  }),
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
  CardGrid,
  Card,
  Toggle,
  Hero,
  Spacer,
  Kbd,
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
  canRestore,
  canPublish,
  canReview,
  canComment,
}: {
  nodeId: string;
  spaceId: string;
  title: string;
  initialContent: object;
  initialStatus: "draft" | "review" | "published";
  publicUrl?: string;
  spacePublic?: boolean;
  canRestore?: boolean;
  canPublish?: boolean;
  canReview?: boolean;
  canComment?: boolean;
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
  const [showHistory, setShowHistory] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [words, setWords] = useState(0);
  const moreRef = useRef<HTMLDivElement>(null);
  const proposedRef = useRef<object | null>(null);
  const slashImageRef = useRef<() => void>(() => {});

  // Faz upload de um arquivo de imagem e o insere no cursor.
  const uploadAndInsert = useCallback(
    async (file: File, ed: NonNullable<typeof editor>) => {
      const url = await uploadImage(file);
      if (url) ed.chain().focus().insertContent({ type: "figureImage", attrs: { src: url, alt: file.name, caption: "" } }).run();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      ...EDITOR_EXTENSIONS,
      createSlashCommand(() => slashImageRef.current()),
      GlobalDragHandle.configure({ dragHandleWidth: 24, scrollTreshold: 100 }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class:
          "prose prose-neutral dark:prose-invert prose-portal max-w-none pl-7 focus:outline-none min-h-[60vh]",
      },
      handlePaste(view, event) {
        const files = Array.from(event.clipboardData?.files ?? []).filter((f) =>
          f.type.startsWith("image/"),
        );
        if (files.length && editorInstance.current) {
          event.preventDefault();
          files.forEach((f) => uploadAndInsert(f, editorInstance.current!));
          return true;
        }
        return false;
      },
      handleDrop(view, event) {
        const files = Array.from((event as DragEvent).dataTransfer?.files ?? []).filter((f) =>
          f.type.startsWith("image/"),
        );
        if (files.length && editorInstance.current) {
          event.preventDefault();
          files.forEach((f) => uploadAndInsert(f, editorInstance.current!));
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      scheduleSave(editor.getJSON());
      setWords(countWords(editor.getText()));
    },
  });
  const editorInstance = useRef(editor);
  editorInstance.current = editor;

  // Abre o seletor de imagem (usado pelo slash command "/Imagem").
  useEffect(() => {
    slashImageRef.current = () => {
      const ed = editorInstance.current;
      if (!ed) return;
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = () => {
        const file = input.files?.[0];
        if (file) void uploadAndInsert(file, ed);
      };
      input.click();
    };
  }, [uploadAndInsert]);

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

  useEffect(() => {
    if (!showMore) return;
    const onDoc = (e: MouseEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setShowMore(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [showMore]);

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

  async function onSubmitReview() {
    const res = await submitForReview(nodeId);
    if (!res.ok) return setMsg(res.error);
    setStatus("review");
    setMsg("Enviado para revisão. Um revisor precisa aprovar para publicar.");
    router.refresh();
  }
  async function onApprove() {
    const res = await approveReview(nodeId);
    if (!res.ok) return setMsg(res.error);
    setStatus("published");
    setMsg("Aprovado e publicado.");
    router.refresh();
  }
  async function onReject() {
    const comment = prompt("Motivo da rejeição (será enviado ao autor):");
    if (comment === null) return;
    const res = await rejectReview(nodeId, comment);
    if (!res.ok) return setMsg(res.error);
    setStatus("draft");
    setMsg("Rejeitado — voltou para rascunho.");
    router.refresh();
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
          <Button variant="secondary" size="sm" onClick={onImprove} disabled={improving} title="Reformatar o texto em blocos ricos (IA)">
            <Wand2 /> <span className="hidden sm:inline">{improving ? "Melhorando…" : "Melhorar layout"}</span>
          </Button>

          <div ref={moreRef} className="relative">
            <Button variant="ghost" size="icon" title="Mais ações" aria-expanded={showMore} onClick={() => setShowMore((v) => !v)}>
              <MoreHorizontal />
            </Button>
            {showMore && (
              <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-xl border border-border bg-bg p-1.5 shadow-2xl">
                <button type="button" className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-2" onClick={() => { setShowHistory(true); setShowMore(false); }}>
                  <History className="size-4 text-text-muted" /> Histórico de versões
                </button>
                <button type="button" disabled={reindexing} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-2 disabled:opacity-50" onClick={() => { onReindex(); setShowMore(false); }}>
                  <Sparkles className="size-4 text-text-muted" /> {reindexing ? "Gerando embeddings…" : "Gerar embeddings"}
                </button>
                <button type="button" className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-2" onClick={() => { setFullscreen((f) => !f); setShowMore(false); }}>
                  {fullscreen ? <Minimize2 className="size-4 text-text-muted" /> : <Maximize2 className="size-4 text-text-muted" />}
                  {fullscreen ? "Sair da tela cheia" : "Tela cheia"}
                </button>
              </div>
            )}
          </div>

          {status === "review" && (
            <span className="rounded-full bg-brand-pink-50 px-2.5 py-1 text-xs font-medium text-brand-pink-700 dark:bg-brand-pink-950/40">
              Em revisão
            </span>
          )}
          {canReview && status === "review" && (
            <>
              <Button variant="secondary" onClick={onReject}>Rejeitar</Button>
              <Button variant="primary" onClick={onApprove}>Aprovar</Button>
            </>
          )}
          {canPublish ? (
            <Button
              variant={status === "published" ? "secondary" : "primary"}
              onClick={onPublishToggle}
            >
              {status === "published" ? "Despublicar" : "Publicar"}
            </Button>
          ) : (
            status === "draft" && (
              <Button variant="primary" onClick={onSubmitReview}>
                Enviar para revisão
              </Button>
            )
          )}
        </div>
      </div>

      <EditorToolbar editor={editor} onUploadImage={uploadImage} />

      {msg && (
        <p className="mt-2 rounded-md bg-brand-pink-50 px-3 py-2 text-sm text-brand-pink-700 dark:bg-brand-pink-950/40 dark:text-brand-pink-300">
          {msg}
        </p>
      )}

      <details className="mt-2 rounded-lg border border-border" open={status === "review"}>
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-text-muted">
          Revisão e comentários
        </summary>
        <div className="border-t border-border p-3">
          <ReviewThread nodeId={nodeId} canComment={!!canComment} />
        </div>
      </details>

      <div className="mt-4 flex-1 overflow-auto">
        <div className="mx-auto max-w-3xl">
          <EditorContent editor={editor} />
        </div>
        <EditorBubbleMenu editor={editor} />
      </div>

      <div className="mt-2 flex items-center justify-end border-t border-border pt-2 text-xs text-text-muted">
        <span className="tabular-nums">{words} palavra{words === 1 ? "" : "s"}</span>
      </div>

      {showHistory && (
        <HistoryPanel
          nodeId={nodeId}
          canRestore={!!canRestore}
          onClose={() => setShowHistory(false)}
        />
      )}

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
