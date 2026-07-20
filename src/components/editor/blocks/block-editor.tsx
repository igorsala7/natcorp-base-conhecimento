"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  BookOpen,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Eye,
  History,
  Keyboard,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Pencil,
  Sparkles,
  Wand2,
} from "lucide-react";
import type { Block, BlockType, BlockDoc } from "@/lib/blocks/schema";
import { normalizeDoc } from "@/lib/blocks/convert";
import { newId } from "@/lib/blocks/schema";
import { BLOCKS } from "@/lib/blocks/registry.meta";
import { blocksToText } from "@/lib/blocks/serialize";
import { RenderBlocks } from "@/lib/blocks/render";
import { moveBlock, findBlock } from "@/lib/blocks/tree-ops";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ancoraDePrevia } from "@/lib/content/preview-anchor";
import { useDismiss } from "./use-dismiss";
import { useEditorActions } from "./use-editor-actions";
import { useUndoRedo } from "./use-undo-redo";
import { useAutosaveArticle } from "./use-autosave-article";
import { BlockList } from "./block-item";
import { EditorToolbar } from "./editor-toolbar";
import { ActiveRichTextProvider, useActiveRichText } from "./rich-text/active";
import { SlashMenu } from "./slash-menu";
import { BlockContextMenu } from "./block-context-menu";
import { ShortcutsHelp } from "./shortcuts-help";
import { PropertiesPanel } from "./properties-panel";
import { HistoryPanel } from "../history-panel";
import { ReviewThread } from "../review-thread";
import {
  submitForReview,
  approveReview,
  rejectReview,
} from "@/app/(admin)/admin/(app)/conteudo/review-actions";
import {
  publishNode,
  unpublishNode,
  discardDraft,
  improveArticleLayout,
  reindexArticleEmbeddings,
} from "@/app/(admin)/admin/(app)/conteudo/article-actions";

function initialBlocks(initial: unknown): Block[] {
  const bs = normalizeDoc(initial).blocks;
  return bs.length ? bs : [{ id: newId(), type: "paragraph", text: [] }];
}

type BlockEditorProps = {
  nodeId: string;
  spaceId: string;
  title: string;
  initialContent: unknown;
  publishedContent?: unknown;
  initialHasDraft?: boolean;
  initialStatus: "draft" | "review" | "published";
  publicUrl?: string;
  spacePublic?: boolean;
  canRestore?: boolean;
  canPublish?: boolean;
  canReview?: boolean;
  canComment?: boolean;
};

/** Provider do "RichText ativo" para a barra do topo formatar a seleção. */
export function BlockEditor(props: BlockEditorProps) {
  return (
    <ActiveRichTextProvider>
      <BlockEditorInner {...props} />
    </ActiveRichTextProvider>
  );
}

function BlockEditorInner({
  nodeId,
  spaceId,
  title,
  initialContent,
  publishedContent,
  initialHasDraft,
  initialStatus,
  publicUrl,
  spacePublic,
  canRestore,
  canPublish,
  canReview,
  canComment,
}: BlockEditorProps) {
  const router = useRouter();
  const [blocks, setBlocks] = useState<Block[]>(() => initialBlocks(initialContent));
  // Conteúdo publicado atual (para "Descartar" reverter). Atualiza ao publicar.
  const publishedRef = useRef<Block[]>(initialBlocks(publishedContent ?? initialContent));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [autoFocusId, setAutoFocusId] = useState<string | null>(null);
  // `id: null` = inserir no FIM do documento (menu aberto na área em branco).
  const [slash, setSlash] = useState<{ id: string | null; rect: DOMRect } | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ block: Block; x: number; y: number } | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showProps, setShowProps] = useState(true);

  const [status, setStatus] = useState(initialStatus);
  const [msg, setMsg] = useState<string | null>(null);
  const [improving, setImproving] = useState(false);
  const [proposed, setProposed] = useState<BlockDoc | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [preview, setPreview] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showPreviewMenu, setShowPreviewMenu] = useState(false);

  const moreRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Desfazer/refazer vivem em `use-undo-redo` — compartilhados com o editor
  // inline da prévia. Aplicar histórico NÃO pula o autosave de propósito: o
  // estado desfeito também precisa ser persistido.
  const { desfazer, refazer, pode: podeHistorico, revisao } = useUndoRedo(
    blocks,
    setBlocks,
    useCallback(() => {
      setSelectedId(null);
      setSlash(null);
      setCtxMenu(null);
    }, []),
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const activeRT = useActiveRichText();

  // Autosave (debounce + semântica de rascunho) em `use-autosave-article`.
  const {
    saveState,
    hasDraft,
    setHasDraft,
    erro: erroSalvar,
    flush,
    pularProximo,
  } = useAutosaveArticle(nodeId, blocks, { hasDraftInicial: !!initialHasDraft });

  useDismiss(moreRef, showMore, useCallback(() => setShowMore(false), []));
  useDismiss(previewRef, showPreviewMenu, useCallback(() => setShowPreviewMenu(false), []));

  // API de mutação compartilhada com o editor inline da prévia.
  const actions = useEditorActions({ setBlocks, setSelectedId, setAutoFocusId, setSlash });

  function onSlashSelect(type: BlockType) {
    const target = slash;
    setSlash(null);
    if (!target) return;

    // Aberto na área em branco: acrescenta no fim do documento.
    if (target.id === null) {
      const nb = BLOCKS[type].defaultData();
      setBlocks((bs) => [...bs, nb]);
      setAutoFocusId(nb.id);
      setSelectedId(nb.id);
      return;
    }
    const tb = findBlock(blocks, target.id);
    const emptyText = tb && "text" in tb && tb.text.length === 0;
    if (emptyText) {
      actions.transform(target.id, type);
    } else {
      actions.insertAfter(target.id, type);
    }
  }

  /** Botão direito na área em branco do canvas → menu de blocos no cursor. */
  function onCanvasContextMenu(e: React.MouseEvent) {
    if (preview) return;
    // Dentro de um bloco o menu é o do bloco (ele faz stopPropagation).
    e.preventDefault();
    setSlash({
      id: null,
      rect: new DOMRect(e.clientX, e.clientY, 0, 0),
    });
  }

  /**
   * Atalhos de bloco/página. Os atalhos de formatação inline (⌘B/I/E/K, ⌘⇧X/H)
   * são tratados no <RichText>, que faz stopPropagation — por isso não colidem.
   */
  function onRootKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setSlash(null);
      setCtxMenu(null);
      setSelectedId(null);
      return;
    }
    const mod = e.metaKey || e.ctrlKey;

    // Mover bloco: ⌥⇧↑ / ⌥⇧↓
    if (e.altKey && e.shiftKey && selectedId && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      actions.move(selectedId, e.key === "ArrowUp" ? -1 : 1);
      return;
    }
    if (!mod) return;

    // Desfazer/refazer. preventDefault é obrigatório: sem ele o "desfazer"
    // nativo do contentEditable também dispara e briga com o nosso histórico.
    const tecla = e.key.toLowerCase();
    if (tecla === "z") {
      e.preventDefault();
      if (e.shiftKey) refazer();
      else desfazer();
      return;
    }
    if (tecla === "y") {
      e.preventDefault();
      refazer();
      return;
    }

    // Página
    if (e.shiftKey && e.key.toLowerCase() === "p") {
      e.preventDefault();
      setPreview((p) => !p);
      setSelectedId(null);
      return;
    }
    if (e.key === "?" || (e.shiftKey && e.key === "/")) {
      e.preventDefault();
      setShowShortcuts(true);
      return;
    }

    if (!selectedId) return;
    const id = selectedId;

    // Inserir bloco
    if (e.key === "Enter") {
      e.preventDefault();
      actions.insertAfter(id, "paragraph");
      return;
    }
    if (e.key === "/") {
      e.preventDefault();
      const el = document.querySelector(`[data-block-id="${id}"]`);
      const rect = el?.getBoundingClientRect();
      if (rect) actions.openSlash(id, rect);
      return;
    }
    // Duplicar / excluir
    if (!e.shiftKey && e.key.toLowerCase() === "d") {
      e.preventDefault();
      actions.duplicate(id);
      return;
    }
    if (e.shiftKey && (e.key === "Backspace" || e.key === "Delete")) {
      e.preventDefault();
      actions.remove(id);
      return;
    }

    // Transformar: ⌘⇧ 0/1/2/3/7/8/9
    if (e.shiftKey) {
      const byKey: Record<string, () => void> = {
        "0": () => actions.transform(id, "paragraph"),
        "1": () => actions.transformHeading(id, 1),
        "2": () => actions.transformHeading(id, 2),
        "3": () => actions.transformHeading(id, 3),
        "7": () => actions.transform(id, "orderedList"),
        "8": () => actions.transform(id, "bulletList"),
        "9": () => actions.transform(id, "quote"),
      };
      const run = byKey[e.key];
      if (run) {
        e.preventDefault();
        run();
      }
    }
  }

  // ── Ações da barra de ferramentas ───────────────────────────────────────
  /** Insere depois do bloco selecionado (ou no fim, se nada estiver selecionado). */
  function toolbarInsert(type: BlockType) {
    const target = selectedId ?? blocks[blocks.length - 1]?.id;
    if (target) actions.insertAfter(target, type);
  }
  function toolbarMoreBlocks() {
    const id = selectedId ?? blocks[blocks.length - 1]?.id;
    if (!id) return;
    const rect = document.querySelector(`[data-block-id="${id}"]`)?.getBoundingClientRect();
    if (rect) actions.openSlash(id, rect);
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      setBlocks((bs) => moveBlock(bs, String(active.id), String(over.id)));
    }
  }

  async function onImprove() {
    setImproving(true);
    setMsg(null);
    const res = await improveArticleLayout(nodeId);
    setImproving(false);
    if (!res.ok) return setMsg(res.error);
    setProposed(normalizeDoc(res.doc));
  }
  function applyImprove() {
    if (proposed) setBlocks(proposed.blocks.length ? proposed.blocks : blocks);
    setProposed(null);
  }

  async function onReindex() {
    setReindexing(true);
    setMsg(null);
    const res = await reindexArticleEmbeddings(nodeId);
    setReindexing(false);
    setMsg(res.ok ? "Embeddings gerados — o assistente já usa este artigo." : res.error);
  }

  async function onSubmitReview() {
    const res = await submitForReview(nodeId);
    if (!res.ok) return setMsg(res.error);
    setStatus("review");
    setMsg("Enviado para revisão.");
    router.refresh();
  }
  async function onApprove() {
    const res = await approveReview(nodeId);
    if (!res.ok) return setMsg(res.error);
    setStatus("published");
    router.refresh();
  }
  async function onReject() {
    const comment = prompt("Motivo da rejeição:");
    if (comment === null) return;
    const res = await rejectReview(nodeId, comment);
    if (!res.ok) return setMsg(res.error);
    setStatus("draft");
    router.refresh();
  }
  async function onPublishToggle() {
    // Despublica só quando está publicado e SEM rascunho pendente. Caso
    // contrário, publica (comitando o rascunho, se houver).
    const willUnpublish = status === "published" && !hasDraft;
    if (!willUnpublish) await flush(); // garante o rascunho mais recente salvo
    const res = willUnpublish ? await unpublishNode(nodeId) : await publishNode(nodeId);
    if (!res.ok) return setMsg(res.error);
    setStatus(willUnpublish ? "draft" : "published");
    setHasDraft(false);
    publishedRef.current = blocks; // o conteúdo atual passou a ser o oficial
    setMsg(null);
    router.refresh();
  }

  /** Descarta o rascunho e volta ao conteúdo publicado. */
  async function onDiscard() {
    if (!window.confirm("Descartar as alterações não publicadas e voltar ao conteúdo publicado?")) return;
    const res = await discardDraft(nodeId);
    if (!res.ok) return setMsg(res.error);
    pularProximo(); // reversão: não deve virar um novo rascunho
    setBlocks(publishedRef.current);
    setHasDraft(false);
    setSelectedId(null);
    setMsg(null);
  }

  const words = useMemo(() => {
    const t = blocksToText(blocks).trim();
    return t ? t.split(/\s+/).length : 0;
  }, [blocks]);
  const selected = selectedId ? findBlock(blocks, selectedId) : null;
  const noSnippets = useMemo(() => new Map<string, Block[]>(), []);

  return (
    <div
      onKeyDown={onRootKeyDown}
      className={fullscreen ? "fixed inset-0 z-40 flex flex-col overflow-hidden bg-bg p-4 md:p-8" : "flex h-full flex-col"}
    >
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
          <span className="text-xs text-text-muted">
            {saveState === "saving"
              ? "Salvando…"
              : saveState === "error"
                ? "Erro ao salvar"
                : hasDraft
                  ? "Rascunho"
                  : status === "published"
                    ? "Publicado"
                    : status === "review"
                      ? "Em revisão"
                      : "Rascunho"}
          </span>
          {hasDraft && (
            <span
              className="ml-2 rounded-full bg-brand-pink-50 px-2 py-0.5 text-[11px] font-medium text-brand-pink-700 dark:bg-brand-pink-950/40"
              title="A página pública ainda mostra a versão publicada. Publique para aplicar."
            >
              Alterações não publicadas
            </span>
          )}
          {publicUrl && (
            <div className="mt-1 flex items-center gap-1 text-xs">
              <a href={publicUrl} target="_blank" rel="noreferrer" title="Abrir a página pública" className="flex max-w-[380px] items-center gap-1 truncate text-text-muted hover:text-primary">
                <ExternalLink className="size-3 shrink-0" />
                <span className="truncate">{publicUrl.replace(/^https?:\/\//, "")}</span>
              </a>
              <button type="button" title="Copiar link público" onClick={() => { navigator.clipboard.writeText(publicUrl); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 1500); }} className="rounded p-0.5 text-text-muted hover:bg-surface-2 hover:text-text">
                {linkCopied ? <Check className="size-3 text-primary" /> : <Copy className="size-3" />}
              </button>
              {(status !== "published" || !spacePublic) && (
                <span className="text-brand-pink-700" title={status !== "published" ? "Publique o artigo para o link ficar ativo" : "O espaço não é público"}>
                  • {status !== "published" ? "rascunho" : "espaço privado"}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Um botão só para as duas prévias. Em prévia individual ele NÃO
              abre a lista: vira a saída, senão o modo vira um beco. */}
          {preview ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setPreview(false)}
              title="Voltar a editar"
            >
              <Pencil /> <span className="hidden sm:inline">Editar</span>
            </Button>
          ) : (
            <div ref={previewRef} className="relative">
              <Button
                variant="secondary"
                size="sm"
                aria-expanded={showPreviewMenu}
                aria-haspopup="menu"
                onClick={() => setShowPreviewMenu((v) => !v)}
                title="Ver como fica publicado"
              >
                <Eye /> <span className="hidden sm:inline">Prévia</span>
                <ChevronDown className="size-3 opacity-60" />
              </Button>
              {showPreviewMenu && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-30 mt-1 w-64 rounded-lg border border-border bg-surface p-1.5 shadow-2"
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-2"
                    onClick={() => {
                      setPreview(true);
                      setSelectedId(null);
                      setShowPreviewMenu(false);
                    }}
                  >
                    <Eye className="mt-0.5 size-4 shrink-0 text-text-muted" />
                    <span>
                      <span className="block font-medium">Individual</span>
                      <span className="block text-xs text-text-muted">
                        Só este artigo, aqui mesmo.
                      </span>
                    </span>
                  </button>
                  {/* Nova aba: conferir não pode custar perder o que se edita. */}
                  <a
                    role="menuitem"
                    href={`/admin/previa/${spaceId}#${ancoraDePrevia(nodeId)}`}
                    target="_blank"
                    rel="noopener"
                    className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-2"
                    onClick={() => setShowPreviewMenu(false)}
                  >
                    <BookOpen className="mt-0.5 size-4 shrink-0 text-text-muted" />
                    <span>
                      <span className="block font-medium">Na documentação</span>
                      <span className="block text-xs text-text-muted">
                        Este artigo dentro do todo, incluindo o que não foi publicado.
                      </span>
                    </span>
                  </a>
                </div>
              )}
            </div>
          )}
          {/* Alterna no MESMO lugar: em tela cheia o botão é a saída. */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setFullscreen((f) => !f)}
            aria-pressed={fullscreen}
            title={fullscreen ? "Sair da tela cheia" : "Tela cheia"}
          >
            {fullscreen ? <Minimize2 /> : <Maximize2 />}
          </Button>
          <div ref={moreRef} className="relative">
            <Button variant="ghost" size="icon" title="Mais ações" aria-expanded={showMore} onClick={() => setShowMore((v) => !v)}>
              <MoreHorizontal />
            </Button>
            {showMore && (
              <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-lg border border-border bg-surface p-1.5 shadow-2">
                <button type="button" disabled={improving} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-2 disabled:opacity-50" onClick={() => { onImprove(); setShowMore(false); }} title="Reformatar o texto em blocos ricos (IA)">
                  <Wand2 className="size-4 text-text-muted" /> {improving ? "Melhorando…" : "Melhorar layout"}
                </button>
                <button type="button" className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-2" onClick={() => { setShowHistory(true); setShowMore(false); }}>
                  <History className="size-4 text-text-muted" /> Histórico de versões
                </button>
                <button type="button" disabled={reindexing} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-2 disabled:opacity-50" onClick={() => { onReindex(); setShowMore(false); }}>
                  <Sparkles className="size-4 text-text-muted" /> {reindexing ? "Gerando embeddings…" : "Gerar embeddings"}
                </button>
                <button type="button" className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-2" onClick={() => { setShowShortcuts(true); setShowMore(false); }}>
                  <Keyboard className="size-4 text-text-muted" /> Atalhos do teclado
                </button>
              </div>
            )}
          </div>
          {status === "review" && (
            <span className="rounded-full bg-brand-pink-50 px-2.5 py-1 text-xs font-medium text-brand-pink-700 dark:bg-brand-pink-950/40">Em revisão</span>
          )}
          {canReview && status === "review" && (
            <>
              <Button variant="secondary" onClick={onReject}>Rejeitar</Button>
              <Button variant="primary" onClick={onApprove}>Aprovar</Button>
            </>
          )}
          {hasDraft && (
            <Button variant="ghost" onClick={onDiscard} title="Descartar as alterações e voltar ao conteúdo publicado">
              Descartar
            </Button>
          )}
          {canPublish ? (
            <Button
              variant={status === "published" && !hasDraft ? "secondary" : "primary"}
              onClick={onPublishToggle}
            >
              {hasDraft ? "Publicar alterações" : status === "published" ? "Despublicar" : "Publicar"}
            </Button>
          ) : (
            status === "draft" && <Button variant="primary" onClick={onSubmitReview}>Enviar para revisão</Button>
          )}
        </div>
      </div>

      <EditorToolbar
        hasSelection={!!selectedId}
        canUndo={podeHistorico.desfazer}
        canRedo={podeHistorico.refazer}
        onUndo={desfazer}
        onRedo={refazer}
        preview={preview}
        onFormat={(mark) => activeRT?.current?.toggleMark(mark)}
        onLink={() => activeRT?.current?.link()}
        onInsert={toolbarInsert}
        onTransform={(t) => selectedId && actions.transform(selectedId, t)}
        onTransformHeading={(l) => selectedId && actions.transformHeading(selectedId, l)}
        onMoreBlocks={toolbarMoreBlocks}
        onDuplicate={() => selectedId && actions.duplicate(selectedId)}
        onDelete={() => selectedId && actions.remove(selectedId)}
        onProperties={() => setShowProps(true)}
        onTogglePreview={() => {
          setPreview((p) => !p);
          setSelectedId(null);
        }}
        onShortcuts={() => setShowShortcuts(true)}
      />

      {(msg ?? erroSalvar) && (
        <p role="alert" className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">{msg ?? erroSalvar}</p>
      )}

      <details className="mt-2 rounded-lg border border-border" open={status === "review"}>
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-text-muted">Revisão e comentários</summary>
        <div className="border-t border-border p-3">
          <ReviewThread nodeId={nodeId} canComment={!!canComment} />
        </div>
      </details>

      {/* Corpo: canvas + painel de propriedades. O canvas usa o MESMO contexto
          tipográfico do portal (.prose prose-portal) para o que se edita
          aparecer idêntico ao que o usuário final vê. */}
      <div className="mt-4 flex min-h-0 flex-1">
        <div
          className="flex-1 overflow-auto"
          onClick={() => !preview && setSelectedId(null)}
          onContextMenu={onCanvasContextMenu}
        >
          {/* min-h garante área clicável abaixo do último bloco */}
          <div className="mx-auto min-h-full max-w-3xl pl-12">
            <div className="prose prose-neutral prose-portal max-w-none dark:prose-invert">
              {preview ? (
                <RenderBlocks blocks={blocks} snippets={noSnippets} />
              ) : (
                <DndContext
                  // Id fixo pelo mesmo motivo da árvore (ver `content/tree.tsx`).
                  // Precisa ser DIFERENTE do dela: as duas convivem na mesma
                  // página do editor.
                  id="dnd-editor-blocos"
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={onDragEnd}
                >
                  <BlockList
                    key={revisao}
                    blocks={blocks}
                    actions={actions}
                    selectedId={selectedId}
                    autoFocusId={autoFocusId}
                    spaceId={spaceId}
                    onContextMenu={(block, x, y) => setCtxMenu({ block, x, y })}
                  />
                </DndContext>
              )}
            </div>
          </div>
        </div>
        {!preview && selected && showProps && (
          <PropertiesPanel block={selected} actions={actions} onClose={() => setShowProps(false)} />
        )}
      </div>

      <div className="mt-2 flex items-center justify-end border-t border-border pt-2 text-xs text-text-muted">
        <span className="tabular-nums">{words} palavra{words === 1 ? "" : "s"}</span>
      </div>

      {slash && <SlashMenu rect={slash.rect} onSelect={onSlashSelect} onClose={() => setSlash(null)} />}

      {ctxMenu && (
        <BlockContextMenu
          block={ctxMenu.block}
          x={ctxMenu.x}
          y={ctxMenu.y}
          actions={actions}
          onClose={() => setCtxMenu(null)}
          onProperties={() => {
            setSelectedId(ctxMenu.block.id);
            setShowProps(true);
          }}
        />
      )}

      {showShortcuts && <ShortcutsHelp onClose={() => setShowShortcuts(false)} />}

      {showHistory && (
        <HistoryPanel nodeId={nodeId} canRestore={!!canRestore} onClose={() => setShowHistory(false)} />
      )}

      <Dialog
        open={!!proposed}
        onClose={() => setProposed(null)}
        size="lg"
        title="Nova formatação proposta pela IA"
        description="A IA reformata sem reescrever. Revise antes de aplicar."
        footer={
          <>
            <Button variant="ghost" onClick={() => setProposed(null)}>
              Cancelar
            </Button>
            <Button onClick={applyImprove}>Aplicar</Button>
          </>
        }
      >
        {proposed && (
          <div className="prose prose-neutral prose-portal max-h-[60vh] max-w-none overflow-auto dark:prose-invert">
            <RenderBlocks blocks={proposed.blocks} snippets={new Map()} />
          </div>
        )}
      </Dialog>
    </div>
  );
}
