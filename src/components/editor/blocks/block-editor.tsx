"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  closestCenter,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { EyeOff,
  BookOpen,
  Check,
  ClipboardPaste,
  Code2,
  Copy,
  ExternalLink,
  Eye,
  History,
  CalendarClock,
  Gauge,
  GripVertical,
  Keyboard,
  MessageSquareText,
  LayoutTemplate,
  Repeat2,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Pencil,
  PenLine,
  Redo2,
  Sparkles,
  Trash2,
  Undo2,
  Wand2,
  ArrowLeft,
} from "lucide-react";
import type { Block, BlockType, BlockDoc, ChartType } from "@/lib/blocks/schema";
import { normalizeDoc } from "@/lib/blocks/convert";
import { newId } from "@/lib/blocks/schema";
import { BLOCKS, slashBlocks, graficoPadrao } from "@/lib/blocks/registry.meta";
import { blocksToText, blocksToPlainWithImageMarkers, type ImageMarker } from "@/lib/blocks/serialize";
import { RenderBlocks } from "@/lib/blocks/render";
import { moveBlock, findBlock, topAncestorId, cloneBlocksWithNewIds } from "@/lib/blocks/tree-ops";
import { copyBlocksToClipboard, readBlocksFromClipboard } from "@/lib/blocks/clipboard";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { CRIATIVIDADES, type Criatividade } from "@/lib/ai/creativity";
import { Dialog } from "@/components/ui/dialog";
import { EmbedDialog } from "@/components/content/embed-dialog";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { useLoader } from "@/components/ui/loader";
import { ancoraDePrevia } from "@/lib/content/preview-anchor";
import { useDismiss } from "./use-dismiss";
import { useEditorActions } from "./use-editor-actions";
import { usePasteBlocks } from "./use-paste-blocks";
import { useUndoRedo } from "./use-undo-redo";
import { useAutosaveArticle } from "./use-autosave-article";
import { BlockList } from "./block-item";
import { GroupBar } from "./group-bar";
import { SendToArticleDialog } from "./send-to-article-dialog";
import {
  ResizablePanel,
  CollapseButton,
  CollapsedRail,
  useCollapsiblePanel,
} from "@/components/ui/resizable-panel";
import { groupBlocks } from "@/lib/blocks/group";
import { FindReplaceBar } from "./find-replace-bar";
import { findMatches, replaceOne, replaceAll, type FindMatch } from "@/lib/blocks/find-replace";
import { BlockPalette } from "./block-palette";
import { BlockInspector } from "./block-inspector";
import { ActiveRichTextProvider, useActiveRichText } from "./rich-text/active";
import { SlashMenu } from "./slash-menu";
import { BlockContextMenu } from "./block-context-menu";
import { ShortcutsHelp } from "./shortcuts-help";
import { MetadataCard } from "../metadata-card";
import { HistoryPanel } from "../history-panel";
import { ScheduleDialog } from "../schedule-dialog";
import { OptimizePanel } from "../optimize-panel";
import { EditorChat } from "../editor-chat";
import {
  LayoutQuestionsForm,
  diretivasEscolhidas,
} from "../layout-questions";
import type { LayoutQuestion } from "@/lib/importer/question-schema";
import { diretivasParaDirecao } from "@/lib/importer/question-schema";
import { remixArticle, type RemixTipo } from "@/app/(admin)/admin/(app)/conteudo/generate-actions";
import {
  listSnippets,
  saveArticleAsTemplate,
  saveBlocksAsSnippet,
} from "@/app/(admin)/admin/(app)/conteudo/template-actions";
import { insertAfter as insertBlockAfter } from "@/lib/blocks/tree-ops";
import { createNode, deleteNode } from "@/app/(admin)/admin/(app)/conteudo/actions";
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
  saveArticle,
  improveArticleLayout,
  improveBlocks,
  proposeArticleLayoutQuestions,
  improveArticleText,
  type TextoAcao,
  type TomAlvo,
} from "@/app/(admin)/admin/(app)/conteudo/article-actions";

/**
 * Aplica a proposta da IA de texto no bloco: substitui o texto mantendo o
 * tipo. Num parágrafo, quebras duplas viram parágrafos novos logo abaixo —
 * "expandir" costuma devolver mais de um. Formatação inline do trecho antigo
 * (negrito etc.) é substituída junto com o texto; o diálogo avisa.
 */
function aplicarTextoNoBloco(bs: Block[], id: string, proposta: string): Block[] {
  const partes = proposta
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter(Boolean);
  if (partes.length === 0) return bs;

  const walk = (list: Block[]): Block[] =>
    list.flatMap((b) => {
      if (b.id === id && "text" in b) {
        if (b.type === "paragraph" && partes.length > 1) {
          return partes.map((p, i) =>
            i === 0
              ? { ...b, text: [{ text: p }] }
              : ({ id: newId(), type: "paragraph", text: [{ text: p }] } as Block),
          );
        }
        return [{ ...b, text: [{ text: partes.join(" ") }] } as Block];
      }
      if ("children" in b && b.children) {
        return [{ ...b, children: walk(b.children) } as Block];
      }
      return [b];
    });
  return walk(bs);
}

/** Ações do menu "IA no texto" — separado do "Melhorar layout" de propósito. */
const ACOES_IA_TEXTO: { acao: TextoAcao; tom?: TomAlvo; rotulo: string }[] = [
  { acao: "formatar", rotulo: "Ajustar formatação" },
  { acao: "reescrever", rotulo: "Reescrever com clareza" },
  { acao: "expandir", rotulo: "Expandir (sem inventar)" },
  { acao: "resumir", rotulo: "Resumir" },
  { acao: "tom", tom: "formal", rotulo: "Tom formal" },
  { acao: "tom", tom: "casual", rotulo: "Tom casual" },
  { acao: "tom", tom: "tecnico", rotulo: "Tom técnico" },
];

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
  canDelete?: boolean;
  /** Escala de leitura do tema da documentação (Aparência → Leitura) — o
   *  canvas edita no MESMO tamanho em que o portal exibe. */
  readingSize?: "compact" | "normal" | "large";
  nodeSlug?: string;
  nodeIcon?: string | null;
  /** Meta description do nó (auditoria do painel Otimizar). */
  nodeDescription?: string | null;
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
  canDelete,
  readingSize = "normal",
  nodeDescription,
  nodeSlug,
  nodeIcon,
}: BlockEditorProps) {
  const router = useRouter();
  const { confirmar, pedirTexto } = useConfirm();
  const toast = useToast();
  const loader = useLoader();
  const [blocks, setBlocks] = useState<Block[]>(() => initialBlocks(initialContent));
  // Conteúdo publicado atual (para "Descartar" reverter). Atualiza ao publicar.
  const publishedRef = useRef<Block[]>(initialBlocks(publishedContent ?? initialContent));
  // Seleção MÚLTIPLA (shift/ctrl/cmd+clique). `selectedId` (único) segue
  // derivado para todo o resto — inspetor, atalhos por bloco, IA — que só faz
  // sentido com exatamente um selecionado; o shim `setSelectedId` mantém os
  // call sites antigos intactos.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedId = selectedIds.length === 1 ? selectedIds[0]! : null;
  // Diálogo "copiar/mover para artigo" — guarda os blocos + ids de topo da seleção.
  const [enviar, setEnviar] = useState<{ blocks: Block[]; tops: string[] } | null>(null);

  // ── Localizar e substituir (Ctrl+F) ──────────────────────────────────────
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findReplace, setFindReplace] = useState("");
  const [findCase, setFindCase] = useState(false);
  const [findIndex, setFindIndex] = useState(-1); // -1 = nada focado ainda

  const matches = useMemo(
    () => (findOpen && findQuery ? findMatches(blocks, findQuery, findCase) : []),
    [findOpen, findQuery, findCase, blocks],
  );

  /** Rola até o bloco e SELECIONA no DOM o trecho achado (realce nativo). */
  function focarMatch(m: FindMatch | undefined) {
    if (!m) return;
    const host = document.querySelector<HTMLElement>(`[data-block-id="${m.blockId}"]`);
    if (!host) return;
    host.scrollIntoView({ block: "center", behavior: "smooth" });
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        // Ignora texto de blocos FILHOS (que têm o próprio data-block-id).
        let p = node.parentElement;
        while (p && p !== host) {
          if (p.hasAttribute("data-block-id")) return NodeFilter.FILTER_REJECT;
          p = p.parentElement;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let acc = 0;
    let sNode: Node | null = null;
    let sOff = 0;
    let eNode: Node | null = null;
    let eOff = 0;
    let node = walker.nextNode();
    while (node) {
      const len = node.textContent?.length ?? 0;
      if (sNode === null && m.start <= acc + len) {
        sNode = node;
        sOff = m.start - acc;
      }
      if (m.end <= acc + len) {
        eNode = node;
        eOff = m.end - acc;
        break;
      }
      acc += len;
      node = walker.nextNode();
    }
    if (!sNode || !eNode) return;
    try {
      const range = document.createRange();
      range.setStart(sNode, sOff);
      range.setEnd(eNode, eOff);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    } catch {
      /* estrutura inesperada: o scroll já orienta o usuário */
    }
  }

  /** Vai para o match de índice `idx` (com wrap) e o realça. */
  function irPara(idx: number) {
    if (!matches.length) return;
    const n = ((idx % matches.length) + matches.length) % matches.length;
    setFindIndex(n);
    const m = matches[n];
    requestAnimationFrame(() => focarMatch(m));
  }

  function substituirAtual() {
    if (!matches.length) return;
    const m = matches[findIndex < 0 ? 0 : findIndex];
    if (m) setBlocks((bs) => replaceOne(bs, m, findReplace));
  }

  function substituirTudo() {
    const { blocks: nb, count } = replaceAll(blocks, findQuery, findReplace, findCase);
    if (count) {
      setBlocks(nb);
      toast.success(`${count} ocorrência(s) substituída(s).`);
    } else {
      toast.info("Nada encontrado para substituir.");
    }
  }

  // Ctrl/Cmd+F abre a barra e impede o "localizar" nativo do navegador.
  useEffect(() => {
    function onFindKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        const sel = window.getSelection()?.toString().trim();
        if (sel) {
          setFindQuery(sel);
          setFindIndex(-1);
        }
        setFindOpen(true);
      }
    }
    document.addEventListener("keydown", onFindKey);
    return () => document.removeEventListener("keydown", onFindKey);
  }, []);
  const setSelectedId = (id: string | null) => setSelectedIds(id == null ? [] : [id]);
  const [autoFocusId, setAutoFocusId] = useState<string | null>(null);
  // `id: null` = inserir no FIM do documento (menu aberto na área em branco).
  const [slash, setSlash] = useState<{ id: string | null; rect: DOMRect } | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ block: Block; x: number; y: number } | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const [status, setStatus] = useState(initialStatus);
  const [improving, setImproving] = useState(false);
  const [proposed, setProposed] = useState<BlockDoc | null>(null);
  // Alvo do "Melhorar layout": `null` = artigo inteiro (substitui tudo);
  // lista de ids = blocos de topo selecionados (substitui só eles — pode virar
  // vários blocos, ex.: texto → tabela → texto).
  const [proposedTarget, setProposedTarget] = useState<string[] | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [preview, setPreview] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [embedOpen, setEmbedOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showOptimize, setShowOptimize] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [remix, setRemix] = useState<{ tipo: RemixTipo; blocks: Block[] } | null>(null);
  const [remixando, setRemixando] = useState<RemixTipo | null>(null);
  const [layoutPerguntas, setLayoutPerguntas] = useState<LayoutQuestion[] | null>(null);
  // Criatividade da IA (Melhorar Layout e IA no texto). Preferência da sessão.
  const [criatividade, setCriatividade] = useState<Criatividade>("equilibrado");
  const [layoutRespostas, setLayoutRespostas] = useState<Record<string, number>>({});
  const [snippetsDisponiveis, setSnippetsDisponiveis] = useState<{ key: string; title: string }[]>([]);

  useEffect(() => {
    let alive = true;
    void listSnippets(spaceId).then((sn) => alive && setSnippetsDisponiveis(sn));
    return () => {
      alive = false;
    };
  }, [spaceId]);
  const [showMore, setShowMore] = useState(false);
  const [showAiTexto, setShowAiTexto] = useState(false);
  const [aiTextoBusy, setAiTextoBusy] = useState(false);
  const [aiProposta, setAiProposta] = useState<{
    /** "bloco" = 1 bloco no lugar · "selecao" = os itens escolhidos · "artigo" = tudo. */
    escopo: "bloco" | "selecao" | "artigo";
    blockId: string | null;
    /** Ids dos blocos de topo alvo, quando escopo = "selecao". */
    blockIds: string[] | null;
    /** Imagens do escopo (marcadores ⟦IMG:n⟧) — reinseridas no aplicar. */
    images: ImageMarker[];
    rotulo: string;
    original: string;
    proposta: string;
  } | null>(null);

  const moreRef = useRef<HTMLDivElement>(null);
  const aiTextoRef = useRef<HTMLDivElement>(null);

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
  // Rótulo do chip flutuante durante o arrasto DA PALETA (o sort de blocos já
  // move o próprio nó — só o arrasto de paleta usa DragOverlay).
  const [dragPaleta, setDragPaleta] = useState<string | null>(null);
  // Onde a linha de inserção aparece ao arrastar um bloco da paleta (soltar
  // ENTRE blocos): o id do bloco de topo alvo e se é ABAIXO dele.
  const [dropLinha, setDropLinha] = useState<{ id: string; abaixo: boolean } | null>(null);
  // Ids dos blocos de TOPO (para a colisão da paleta mirar só o nível raiz).
  const rootIdsRef = useRef<Set<string>>(new Set());
  rootIdsRef.current = new Set(blocks.map((b) => b.id));
  const activeRT = useActiveRichText();

  // Recolher/expandir os dois painéis laterais do editor (persistido). A árvore
  // (menu lateral externo) tem o próprio controle no ContentShell.
  const paleta = useCollapsiblePanel("kb.palette");
  const inspetor = useCollapsiblePanel("kb.inspector");

  // Ao selecionar um item (clicar num bloco), recolhe a árvore lateral para
  // sobrar espaço — a documentação já traz a árvore recolhida por padrão, mas
  // se o usuário a abriu, o clique num objeto volta a fechá-la. Só na SUBIDA
  // (nada → algo selecionado); trocar de bloco não redispara.
  const tinhaSelecao = useRef(false);
  useEffect(() => {
    const tem = selectedIds.length > 0;
    if (tem && !tinhaSelecao.current) {
      window.dispatchEvent(new Event("kb:collapse-tree"));
    }
    tinhaSelecao.current = tem;
  }, [selectedIds]);

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
  useDismiss(aiTextoRef, showAiTexto, useCallback(() => setShowAiTexto(false), []));

  // API de mutação compartilhada com o editor inline da prévia.
  const actions = useEditorActions({ setBlocks, setSelectedIds, setAutoFocusId, setSlash });
  const onPaste = usePasteBlocks({ spaceId, insertBlocks: actions.insertBlocks, patch: actions.patch });

  /** Agrupa os blocos selecionados numa nova região do tipo escolhido. */
  function agrupar(type: BlockType) {
    const groupId = newId();
    const r = groupBlocks(blocks, selectedIds, type, groupId);
    if (!r) return;
    setBlocks(r.blocks);
    setSelectedIds([groupId]);
    setAutoFocusId(groupId);
  }

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

  function onSlashChart(chartType: ChartType) {
    const target = slash;
    setSlash(null);
    if (!target) return;
    const nb = graficoPadrao(chartType);
    actions.insertBlocks(target.id, [nb]);
    setSelectedId(nb.id);
  }

  function onSlashSnippet(key: string) {
    const target = slash;
    setSlash(null);
    if (!target) return;
    const nb: Block = { id: newId(), type: "snippet", data: { snippetKey: key } };
    if (target.id === null) setBlocks((bs) => [...bs, nb]);
    else setBlocks((bs) => insertBlockAfter(bs, target.id!, nb));
    setSelectedId(nb.id);
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

  /** Arrasto de PALETA mira SÓ os blocos de TOPO (+ zona final) — assim solta
   *  ENTRE dois blocos (antes/depois pelo ponto médio). O sort de blocos segue
   *  no closestCenter, cego à zona final (senão soltar "perto do fim" jogaria
   *  o bloco para lá). */
  const colisaoEditor: CollisionDetection = useCallback((args) => {
    if (args.active.data.current?.fromPalette) {
      return closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter(
          (c) => c.id === "canvas-end" || rootIdsRef.current.has(String(c.id)),
        ),
      });
    }
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter((c) => c.id !== "canvas-end"),
    });
  }, []);

  function onDragStart(e: DragStartEvent) {
    const data = e.active.data.current;
    if (data?.fromPalette) setDragPaleta(BLOCKS[data.blockType as BlockType].label);
  }

  /** Solto ABAIXO do bloco alvo? (metade de baixo → insere depois dele). */
  function ladoAbaixo(e: DragEndEvent | DragOverEvent): boolean {
    const a = e.active.rect.current.translated;
    const o = e.over?.rect;
    if (!a || !o) return false;
    return a.top + a.height / 2 > o.top + o.height / 2;
  }

  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!active.data.current?.fromPalette || !over || over.id === "canvas-end") {
      setDropLinha(null);
      return;
    }
    setDropLinha({ id: String(over.id), abaixo: ladoAbaixo(e) });
  }

  function onDragEnd(e: DragEndEvent) {
    setDragPaleta(null);
    setDropLinha(null);
    const { active, over } = e;
    const data = active.data.current;
    if (data?.fromPalette) {
      if (!over) return;
      const nb = BLOCKS[data.blockType as BlockType].defaultData();
      const abaixo = ladoAbaixo(e);
      setBlocks((bs) => {
        if (over.id === "canvas-end") return [...bs, nb];
        const i = bs.findIndex((b) => b.id === over.id);
        if (i < 0) return [...bs, nb];
        const pos = abaixo ? i + 1 : i;
        return [...bs.slice(0, pos), nb, ...bs.slice(pos)];
      });
      setSelectedId(nb.id);
      setAutoFocusId(nb.id);
      return;
    }
    if (over && active.id !== over.id && over.id !== "canvas-end") {
      setBlocks((bs) => moveBlock(bs, String(active.id), String(over.id)));
    }
  }

  /** Insere `nb` LOGO APÓS o bloco de topo selecionado (senão, no fim). */
  function inserirAposSelecionado(bs: Block[], nb: Block): Block[] {
    if (!selectedId) return [...bs, nb];
    const topo = topAncestorId(bs, selectedId) ?? selectedId;
    const i = bs.findIndex((b) => b.id === topo);
    return i < 0 ? [...bs, nb] : [...bs.slice(0, i + 1), nb, ...bs.slice(i + 1)];
  }

  /** Clique na paleta: entra após o bloco selecionado (ou no fim), já selecionado. */
  function paletteAdd(type: BlockType) {
    const nb = BLOCKS[type].defaultData();
    setBlocks((bs) => inserirAposSelecionado(bs, nb));
    setSelectedId(nb.id);
    setAutoFocusId(nb.id);
  }
  function paletteAddSnippet(key: string) {
    const nb: Block = { id: newId(), type: "snippet", data: { snippetKey: key } };
    setBlocks((bs) => inserirAposSelecionado(bs, nb));
    setSelectedId(nb.id);
  }

  /** Blocos de TOPO afetados pela seleção (em ordem do documento). */
  function idsDeTopo(bs: Block[], ids: string[]): string[] {
    const tops: string[] = [];
    for (const id of ids) {
      const t = topAncestorId(bs, id) ?? id;
      if (!tops.includes(t)) tops.push(t);
    }
    return tops.sort((a, b) => bs.findIndex((x) => x.id === a) - bs.findIndex((x) => x.id === b));
  }

  /** Blocos de TOPO da seleção, na ordem do artigo (cada um com sua subárvore). */
  function blocosSelecionados(): { tops: string[]; blocos: Block[] } {
    const tops = idsDeTopo(blocks, selectedIds);
    const blocos = tops
      .map((id) => findBlock(blocks, id))
      .filter((b): b is Block => !!b);
    return { tops, blocos };
  }

  /** Copiar: guarda os blocos selecionados na área de transferência (localStorage). */
  function onCopiar() {
    const { blocos } = blocosSelecionados();
    if (!blocos.length) return;
    if (copyBlocksToClipboard(blocos))
      toast.success(`${blocos.length} bloco(s) copiado(s) — cole em qualquer artigo.`);
  }

  /** Recortar: copia e remove os selecionados do artigo. */
  function onRecortar() {
    const { tops, blocos } = blocosSelecionados();
    if (!blocos.length) return;
    if (!copyBlocksToClipboard(blocos)) return;
    const set = new Set(tops);
    setBlocks((bs) => bs.filter((b) => !set.has(b.id)));
    setSelectedIds([]);
    toast.success(`${blocos.length} bloco(s) recortado(s) — cole em qualquer artigo.`);
  }

  /** Abre o diálogo de copiar/mover a seleção para outro artigo. */
  function onEnviarParaArtigo() {
    const { tops, blocos } = blocosSelecionados();
    if (!blocos.length) return;
    setEnviar({ blocks: blocos, tops });
  }

  /** Idem, a partir do menu de contexto: se o bloco está na seleção múltipla,
   *  envia a seleção; senão, só ele. */
  function onEnviarBlocoParaArtigo(blockId: string) {
    const tops = selectedIds.includes(blockId) ? idsDeTopo(blocks, selectedIds) : [blockId];
    const blocos = tops.map((id) => findBlock(blocks, id)).filter((b): b is Block => !!b);
    if (blocos.length) setEnviar({ blocks: blocos, tops });
  }

  /** Colar: acrescenta os blocos copiados AO FIM do artigo, com IDs novos. */
  function onColar() {
    const raw = readBlocksFromClipboard();
    if (!raw?.length) {
      toast.info("Nada foi copiado ainda. Selecione blocos e use Copiar ou Recortar.");
      return;
    }
    const doc = normalizeDoc({ version: 2, blocks: raw });
    const novos = cloneBlocksWithNewIds(doc.blocks);
    if (!novos.length) return;
    setBlocks((bs) => [...bs, ...novos]);
    toast.success(`${novos.length} bloco(s) colado(s) ao fim do artigo.`);
  }

  // Atalhos GLOBAIS de clipboard de BLOCOS entre artigos: Ctrl/Cmd + C (copiar),
  // X (recortar), V (colar). Ficam no DOCUMENTO porque a seleção de blocos pode
  // estar com o foco fora do texto (na barra flutuante, ou logo após navegar
  // para o artigo destino). Refs evitam re-subscrever o listener a cada render.
  const clipRef = useRef({ onColar, onCopiar, onRecortar, selectedIds });
  clipRef.current = { onColar, onCopiar, onRecortar, selectedIds };
  useEffect(() => {
    function onClipKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      const k = e.key.toLowerCase();
      if (k !== "c" && k !== "x" && k !== "v") return;
      const el = document.activeElement as HTMLElement | null;
      const emCampoForm = !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA");
      const c = clipRef.current;

      if (k === "v") {
        // Colar: só fora de campo de texto (dentro, o colar nativo/HTML manda).
        if (emCampoForm || el?.isContentEditable) return;
        if (!readBlocksFromClipboard()?.length) return;
        e.preventDefault();
        c.onColar();
        return;
      }

      // Copiar/Recortar de BLOCOS. Prioridade do copiar NATIVO quando o usuário
      // está num campo de formulário (título/código) ou destacou texto de fato.
      if (emCampoForm) return;
      const textoSel = (typeof window !== "undefined" ? window.getSelection()?.toString() : "") ?? "";
      if (textoSel.trim() !== "") return;
      if (c.selectedIds.length === 0) return;
      // Editando UM bloco (cursor no texto, nada destacado) → deixa o nativo, não
      // sequestra o Ctrl+C de quem só quer copiar dentro do parágrafo.
      if (c.selectedIds.length === 1 && el?.isContentEditable) return;
      e.preventDefault();
      if (k === "c") c.onCopiar();
      else c.onRecortar();
    }
    document.addEventListener("keydown", onClipKey);
    return () => document.removeEventListener("keydown", onClipKey);
  }, []);

  /**
   * Colar (evento nativo do container): se a área de transferência do SO não
   * traz conteúdo (HTML/texto/imagem), mas há blocos recortados/copiados,
   * cola os blocos. Senão, segue o fluxo de Word/Docs/web/imagem (usePasteBlocks).
   */
  function onPasteRoot(e: React.ClipboardEvent) {
    const cd = e.clipboardData;
    const temSistema =
      cd.getData("text/html").trim() !== "" ||
      cd.getData("text/plain").trim() !== "" ||
      Array.from(cd.items ?? []).some((it) => it.kind === "file");
    if (!temSistema && readBlocksFromClipboard()?.length) {
      e.preventDefault();
      onColar();
      return;
    }
    onPaste(e);
  }

  async function onImprove() {
    // A IA lê do banco (artigo inteiro) ou dos blocos selecionados; o flush
    // garante que a última edição da tela esteja salva no rascunho.
    setImproving(true);
    await flush();
    setImproving(false);

    // Com seleção → melhora SÓ os blocos escolhidos (pode desmembrar em vários).
    if (selectedIds.length > 0) {
      await rodarImproveSelecao(idsDeTopo(blocks, selectedIds));
      return;
    }

    // Artigo inteiro → confirmação antes (é uma mudança em tudo).
    const ok = await confirmar({
      title: "Melhorar o layout de todo o artigo?",
      description:
        "A IA reformata o texto em blocos ricos (tabelas, passos, listas, avisos…) sem reescrever. Você revê a proposta antes de aplicar.",
    });
    if (!ok) return;

    // Fase 1 (interativa): a IA lê o texto e PERGUNTA antes de reformatar.
    // Falha do passe de perguntas não bloqueia — cai no fluxo direto.
    setImproving(true);
    const q = await loader.during("Analisando o artigo…", () => proposeArticleLayoutQuestions(nodeId));
    setImproving(false);
    if (q.ok && q.perguntas.length > 0) {
      setLayoutPerguntas(q.perguntas);
      setLayoutRespostas({});
      return;
    }
    if (!q.ok) toast.warning(`Análise indisponível (${q.error}) — reformatando sem perguntas.`);
    await rodarImprove(undefined);
  }

  /** Fase 2 (artigo inteiro): reformatação, com ou sem a direção do autor. */
  async function rodarImprove(direcao: string | undefined) {
    setLayoutPerguntas(null);
    setImproving(true);
    const res = await loader.during("Melhorando o layout com IA…", () =>
      improveArticleLayout(nodeId, direcao, criatividade),
    );
    setImproving(false);
    if (!res.ok) return toast.error(res.error);
    setProposedTarget(null);
    setProposed(normalizeDoc(res.doc));
  }

  /** Melhora só os blocos de topo selecionados (desmembra em vários se couber). */
  async function rodarImproveSelecao(alvos: string[]) {
    const blocosAlvo = alvos
      .map((id) => findBlock(blocks, id))
      .filter((b): b is Block => !!b);
    if (!blocosAlvo.length) return;
    setImproving(true);
    const res = await loader.during("Melhorando o layout com IA…", () =>
      improveBlocks(nodeId, blocosAlvo, undefined, criatividade),
    );
    setImproving(false);
    if (!res.ok) return toast.error(res.error);
    setProposedTarget(alvos);
    setProposed(normalizeDoc(res.doc));
  }
  async function onSalvarModelo() {
    const nome = await pedirTexto({
      title: "Salvar como modelo",
      label: "Nome do modelo",
      description: "O conteúdo atual vira ponto de partida para novos artigos desta documentação.",
      initial: title,
    });
    if (!nome) return;
    await flush();
    const r = await saveArticleAsTemplate(nodeId, nome, null);
    if (r.ok) toast.success("Modelo salvo.");
    else toast.error(r.error);
  }

  async function onSalvarSnippet() {
    if (!selectedId) return;
    const alvo = findBlock(blocks, selectedId);
    if (!alvo) return;
    const nome = await pedirTexto({
      title: "Salvar bloco como snippet",
      label: "Nome do snippet",
      description: "Trecho reutilizável por transclusão: editar o snippet atualiza TODOS os artigos que o usam. Insira pelo menu \"/\".",
    });
    if (!nome) return;
    const r = await saveBlocksAsSnippet(spaceId, nome, [alvo]);
    if (r.ok) {
      toast.success("Snippet salvo.");
      setSnippetsDisponiveis(await listSnippets(spaceId));
    } else toast.error(r.error);
  }

  async function onRemix(tipo: RemixTipo) {
    setRemixando(tipo);
    await flush(); // remixa o que está na tela, não uma versão velha
    const r = await remixArticle(nodeId, tipo);
    setRemixando(null);
    if (!r.ok) return toast.error(r.error);
    setRemix({ tipo, blocks: r.data });
  }

  async function applyRemix() {
    if (!remix) return;
    if (remix.tipo === "tldr") {
      // Resumo entra no TOPO do artigo em edição.
      setBlocks([...remix.blocks, ...blocks]);
      setRemix(null);
      return;
    }
    // FAQ vira um artigo IRMÃO, rascunho.
    const criado = await createNode({
      spaceId,
      parentId: null,
      type: "article",
      title: `FAQ — ${title}`,
    });
    if (!criado.ok || !criado.id) {
      toast.error(!criado.ok ? criado.error : "Falha ao criar o artigo de FAQ.");
      return;
    }
    await saveArticle(criado.id, { version: 2, blocks: remix.blocks });
    setRemix(null);
    router.push(`/admin/conteudo/${criado.id}`);
  }

  function applyImprove() {
    if (proposed && proposed.blocks.length) {
      const novos = proposed.blocks;
      if (proposedTarget) {
        // Seleção: substitui os blocos-alvo pelos propostos, na posição do 1º.
        setBlocks((bs) => {
          const set = new Set(proposedTarget);
          const primeiro = bs.findIndex((b) => set.has(b.id));
          if (primeiro < 0) return bs;
          const antes = bs.slice(0, primeiro).filter((b) => !set.has(b.id));
          const depois = bs.slice(primeiro + 1).filter((b) => !set.has(b.id));
          return [...antes, ...novos, ...depois];
        });
      } else {
        setBlocks(novos); // artigo inteiro
      }
    }
    setProposed(null);
    setProposedTarget(null);
    setSelectedIds([]);
  }

  // ── IA no texto (separada do "Melhorar layout") ─────────────────────────
  // Age no BLOCO selecionado; a resposta vira proposta lado a lado, nunca
  // aplicação direta.
  const aiTextoAlvo =
    selectedId != null
      ? (() => {
          const b = findBlock(blocks, selectedId);
          return b && "text" in b && blocksToText([b]).trim().length >= 8 ? b : null;
        })()
      : null;

  async function onAiTexto(acao: TextoAcao, tom: TomAlvo | undefined, rotulo: string) {
    // 1 bloco de texto → no lugar; vários selecionados → só a seleção; nada → artigo inteiro.
    // Nos escopos artigo/seleção o texto vai com marcadores ⟦IMG:n⟧ para a IA —
    // assim as imagens NÃO se perdem (são reinseridas no aplicar).
    const topIds = idsDeTopo(blocks, selectedIds);
    let escopo: "bloco" | "selecao" | "artigo";
    let original: string;
    let images: ImageMarker[] = [];
    let blockId: string | null = null;
    let blockIds: string[] | null = null;
    if (aiTextoAlvo) {
      escopo = "bloco";
      original = blocksToText([aiTextoAlvo]).trim();
      blockId = aiTextoAlvo.id;
    } else if (selectedIds.length > 0) {
      escopo = "selecao";
      const alvo = topIds.map((id) => findBlock(blocks, id)).filter((b): b is Block => !!b);
      const marc = blocksToPlainWithImageMarkers(alvo);
      original = marc.text.trim();
      images = marc.images;
      blockIds = topIds;
    } else {
      escopo = "artigo";
      const marc = blocksToPlainWithImageMarkers(blocks);
      original = marc.text.trim();
      images = marc.images;
    }
    if (original.length < 8) {
      toast.info("Não há texto suficiente para a IA ajustar.");
      return;
    }
    setShowAiTexto(false);
    setAiTextoBusy(true);
    const res = await loader.during("A IA está ajustando o texto…", () =>
      improveArticleText(nodeId, original, acao, tom, criatividade),
    );
    setAiTextoBusy(false);
    if (!res.ok) return toast.error(res.error);
    setAiProposta({ escopo, blockId, blockIds, images, rotulo, original, proposta: res.proposta });
  }

  /** Quebra a proposta em parágrafos (o formato de texto puro da IA). */
  function propostaEmParagrafos(proposta: string): Block[] {
    return proposta
      .split(/\n{2,}/)
      .map((p) => p.replace(/\n/g, " ").trim())
      .filter(Boolean)
      .map((p) => ({ id: newId(), type: "paragraph", text: [{ text: p }] }) as Block);
  }

  /**
   * Reconstrói a proposta em blocos, reinserindo as imagens nos marcadores
   * ⟦IMG:n⟧ — e, como rede de segurança, jogando ao fim qualquer imagem cujo
   * marcador a IA tenha esquecido. Nenhuma imagem é perdida.
   */
  function propostaComImagens(proposta: string, images: ImageMarker[]): Block[] {
    const imgBloco = (im: ImageMarker): Block =>
      ({ id: newId(), type: "image", data: { src: im.src, alt: im.alt, caption: im.caption } }) as Block;
    const usados = new Set<number>();
    const out: Block[] = [];
    proposta.split(/⟦IMG:(\d+)⟧/).forEach((parte, i) => {
      if (i % 2 === 1) {
        const n = Number(parte);
        const im = images[n];
        if (im?.src && !usados.has(n)) {
          usados.add(n);
          out.push(imgBloco(im));
        }
      } else {
        out.push(...propostaEmParagrafos(parte));
      }
    });
    images.forEach((im, n) => {
      if (im?.src && !usados.has(n)) out.push(imgBloco(im));
    });
    return out;
  }

  function applyAiTexto() {
    if (aiProposta) {
      const imgs = aiProposta.images ?? [];
      if (aiProposta.escopo === "artigo") {
        const novos = propostaComImagens(aiProposta.proposta, imgs);
        if (novos.length) setBlocks(novos);
      } else if (aiProposta.escopo === "selecao" && aiProposta.blockIds) {
        // Substitui os blocos selecionados pela proposta (com as imagens), na posição do 1º.
        const novos = propostaComImagens(aiProposta.proposta, imgs);
        if (novos.length) {
          const set = new Set(aiProposta.blockIds);
          setBlocks((bs) => {
            const primeiro = bs.findIndex((b) => set.has(b.id));
            if (primeiro < 0) return bs;
            const antes = bs.slice(0, primeiro).filter((b) => !set.has(b.id));
            const depois = bs.slice(primeiro + 1).filter((b) => !set.has(b.id));
            return [...antes, ...novos, ...depois];
          });
        }
        setSelectedIds([]);
      } else if (aiProposta.blockId) {
        setBlocks((bs) => aplicarTextoNoBloco(bs, aiProposta.blockId!, aiProposta.proposta));
      }
    }
    setAiProposta(null);
  }

  function onReindex() {
    // A geração vive na aba Embeddings da Importar (job em background com
    // progresso). Abrimos já apontando para este artigo.
    router.push(`/admin/importar?aba=embeddings&space=${spaceId}&node=${nodeId}`);
  }

  async function onSubmitReview() {
    const res = await submitForReview(nodeId);
    if (!res.ok) return toast.error(res.error);
    setStatus("review");
    toast.success("Enviado para revisão.");
    router.refresh();
  }
  async function onApprove() {
    const res = await approveReview(nodeId);
    if (!res.ok) return toast.error(res.error);
    setStatus("published");
    toast.success("Aprovado e publicado.");
    router.refresh();
  }
  async function onReject() {
    const comment = await pedirTexto({
      title: "Rejeitar publicação",
      label: "Motivo da rejeição",
      description: "O autor recebe este motivo junto com a devolução para rascunho.",
      multiline: true,
      confirmLabel: "Rejeitar",
    });
    if (comment === null) return;
    const res = await rejectReview(nodeId, comment);
    if (!res.ok) return toast.error(res.error);
    setStatus("draft");
    toast.success("Devolvido para rascunho.");
    router.refresh();
  }
  /**
   * PUBLICAR e DESPUBLICAR deixam de ser o mesmo botão.
   *
   * Antes era um só, no lugar primário, que mudava de significado conforme o
   * estado: "Publicar", "Publicar alterações" ou "Despublicar". A mesma posição,
   * a mesma cor, e às vezes a ação tirava o artigo do ar — sem confirmar.
   *
   * O produto pede confirmação para excluir um artigo. Tirar do ar sem
   * perguntar era incoerente com ele mesmo: a diferença entre as duas é que a
   * exclusão avisa e a despublicação some em silêncio, com o leitor batendo em
   * 404 numa URL que já foi compartilhada.
   */
  async function onPublish() {
    await flush(); // garante o rascunho mais recente salvo
    const res = await loader.during("Publicando…", () => publishNode(nodeId));
    if (!res.ok) return toast.error(res.error);
    setStatus("published");
    setHasDraft(false);
    publishedRef.current = blocks; // o conteúdo atual passou a ser o oficial
    toast.success("Artigo publicado.");
    router.refresh();
  }

  async function onUnpublish() {
    setShowMore(false);
    const ok = await confirmar({
      title: "Tirar do ar?",
      description:
        "O artigo sai do portal e do chatbot. Quem tiver o link vai bater em página não encontrada — e links de documentação costumam estar colados em e-mail e em conversa.",
      tone: "danger",
      confirmLabel: "Tirar do ar",
    });
    if (!ok) return;
    const res = await loader.during("Despublicando…", () => unpublishNode(nodeId));
    if (!res.ok) return toast.error(res.error);
    setStatus("draft");
    setHasDraft(false);
    toast.success("Artigo despublicado.");
    router.refresh();
  }

  /** Exclui o artigo inteiro (soft delete → lixeira, restaurável em 30 dias). */
  async function onDeleteArticle() {
    setShowMore(false);
    const ok = await confirmar({
      title: "Excluir artigo",
      description: `Excluir "${title}"? Vai para a lixeira e pode ser restaurado em 30 dias.`,
      tone: "danger",
      confirmLabel: "Excluir",
    });
    if (!ok) return;
    const res = await loader.during("Excluindo…", () => deleteNode(nodeId));
    if (!res.ok) return toast.error(res.error);
    toast.success("Artigo enviado para a lixeira.");
    router.push("/admin/conteudo");
  }

  /** Descarta o rascunho e volta ao conteúdo publicado. */
  async function onDiscard() {
    const ok = await confirmar({
      title: "Descartar alterações",
      description: "Descartar as alterações não publicadas e voltar ao conteúdo publicado?",
      tone: "danger",
      confirmLabel: "Descartar",
    });
    if (!ok) return;
    const res = await discardDraft(nodeId);
    if (!res.ok) return toast.error(res.error);
    pularProximo(); // reversão: não deve virar um novo rascunho
    setBlocks(publishedRef.current);
    setHasDraft(false);
    setSelectedId(null);
    toast.success("Alterações descartadas.");
  }

  const words = useMemo(() => {
    const t = blocksToText(blocks).trim();
    return t ? t.split(/\s+/).length : 0;
  }, [blocks]);
  const noSnippets = useMemo(() => new Map<string, Block[]>(), []);

  return (
    <div
      onKeyDown={onRootKeyDown}
      onPaste={onPasteRoot}
      className={fullscreen ? "fixed inset-0 z-40 flex flex-col overflow-hidden bg-bg p-4 md:p-8" : "flex h-full flex-col"}
    >
      {/* Cabeçalho (barra superior Lumina: sticky, translúcida com blur) */}
      <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-surface/90 px-6 py-3 backdrop-blur-lg">
        <Link
          href="/admin/conteudo"
          title="Voltar para a árvore de conteúdo"
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-bold tracking-tight">{title}</h1>
          <span className="text-2xs text-brand-gray-400">
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
          {saveState === "saved" && (
            <span className="ml-2 text-2xs font-semibold text-emerald-600">Salvo</span>
          )}
          {hasDraft && (
            <span
              className="ml-2 rounded-full bg-brand-pink-50 px-2 py-0.5 text-2xs font-medium text-brand-pink-700 dark:bg-brand-pink-950/40"
              title="A página pública ainda mostra a versão publicada. Publique para aplicar."
            >
              Alterações não publicadas
            </span>
          )}
          {publicUrl && (
            <div className="mt-1 flex items-center gap-1 text-xs">
              <a href={publicUrl} target="_blank" rel="noreferrer" title="Abrir a página pública" className="flex max-w-[380px] items-center gap-1 truncate text-text-muted hover:text-primary">
                <ExternalLink className="size-3.5 shrink-0" />
                <span className="truncate">{publicUrl.replace(/^https?:\/\//, "")}</span>
              </a>
              <button type="button" title="Copiar link público" onClick={() => { navigator.clipboard.writeText(publicUrl); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 1500); }} className="rounded p-0.5 text-text-muted hover:bg-surface-2 hover:text-text">
                {linkCopied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
              </button>
              {(status !== "published" || !spacePublic) && (
                <span className="text-brand-pink-700" title={status !== "published" ? "Publique o artigo para o link ficar ativo" : "O espaço não é público"}>
                  • {status !== "published" ? "rascunho" : "espaço privado"}
                </span>
              )}
              {status === "published" && spacePublic && (
                <button
                  type="button"
                  title="Gerar código de iframe deste artigo"
                  onClick={() => setEmbedOpen(true)}
                  className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-text-muted hover:bg-surface-2 hover:text-primary"
                >
                  <Code2 className="size-3.5" /> Incorporar
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Desfazer/refazer moram no cabeçalho desde que a barra superior de
              edição saiu (formatar/inserir/propriedades foram para a paleta e o
              painel direito). */}
          {!preview && (
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="icon" title="Desfazer (⌘Z)" disabled={!podeHistorico.desfazer} onClick={desfazer}>
                <Undo2 />
              </Button>
              <Button variant="ghost" size="icon" title="Refazer (⌘⇧Z)" disabled={!podeHistorico.refazer} onClick={refazer}>
                <Redo2 />
              </Button>
            </div>
          )}
          {/* Um botão só para as duas prévias. Em prévia individual ele NÃO
              abre a lista: vira a saída, senão o modo vira um beco. */}
          <Segmented
            value={preview ? "previa" : "editor"}
            onChange={(v) => {
              setPreview(v === "previa");
              if (v === "previa") setSelectedId(null);
            }}
            options={[
              { value: "editor", label: <><Pencil /> Editor</>, title: "Voltar a editar" },
              { value: "previa", label: <><Eye /> Prévia</>, title: "Ver como fica publicado (⌘⇧P)" },
            ]}
          />
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
          {/* IA no TEXTO — botão próprio, separado do "Melhorar layout" (que
              reformata sem reescrever). Aqui a IA propõe texto novo, e por
              isso o fluxo termina num antes/depois com aceite manual. */}
          <div ref={aiTextoRef} className="relative">
            <Button
              variant="ghost"
              title={
                aiTextoAlvo
                  ? "IA no texto do bloco selecionado (formatar, reescrever, expandir, resumir, tom)"
                  : selectedIds.length > 0
                    ? "IA no texto dos itens selecionados (formatar, reescrever, expandir, resumir, tom)"
                    : "IA no texto do ARTIGO INTEIRO (nada selecionado)"
              }
              aria-expanded={showAiTexto}
              disabled={(!aiTextoAlvo && selectedIds.length === 0 && words === 0) || aiTextoBusy}
              onClick={() => setShowAiTexto((v) => !v)}
            >
              <PenLine className={aiTextoBusy ? "animate-pulse" : ""} />
              <span className="hidden lg:inline">{aiTextoBusy ? "Propondo…" : "IA no texto"}</span>
            </Button>
            {showAiTexto && (
              <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-lg border border-border bg-surface p-1.5 shadow-2">
                <p className="px-2 pb-1.5 pt-1 text-2xs leading-snug text-text-muted">
                  {aiTextoAlvo
                    ? "Age no bloco selecionado."
                    : selectedIds.length > 0
                      ? `Age nos ${selectedIds.length} itens selecionados.`
                      : "Nada selecionado — age no artigo inteiro."}
                </p>
                <div className="px-1 pb-1.5">
                  <p className="mb-1 text-2xs font-medium uppercase tracking-wide text-text-muted">
                    Criatividade
                  </p>
                  <CriatividadeSelect value={criatividade} onChange={setCriatividade} />
                </div>
                {ACOES_IA_TEXTO.map((a) => (
                  <button
                    key={a.rotulo}
                    type="button"
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-2"
                    onClick={() => onAiTexto(a.acao, a.tom, a.rotulo)}
                  >
                    <PenLine className="size-4 text-text-muted" /> {a.rotulo}
                  </button>
                ))}
                <p className="px-2 pb-1 pt-1.5 text-xs text-text-muted">
                  A proposta aparece antes de ser aplicada.
                </p>
              </div>
            )}
          </div>
          <div ref={moreRef} className="relative">
            <Button variant="ghost" size="icon" title="Mais ações" aria-expanded={showMore} onClick={() => setShowMore((v) => !v)}>
              <MoreHorizontal />
            </Button>
            {showMore && (
              <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-lg border border-border bg-surface p-1.5 shadow-2">
                <p className="px-2 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wider text-text-muted">Ver</p>
                <a
                  href={`/admin/previa/${spaceId}#${ancoraDePrevia(nodeId)}`}
                  target="_blank"
                  rel="noopener"
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-2"
                  onClick={() => setShowMore(false)}
                  title="Este artigo dentro do todo, incluindo o que não foi publicado"
                >
                  <BookOpen className="size-4 text-text-muted" /> Prévia na documentação
                </a>
                {status !== "review" && (
                  <button type="button" className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-2" onClick={() => { setShowReview((v) => !v); setShowMore(false); }} title="Mostrar/ocultar os comentários de revisão deste artigo">
                    <MessageSquareText className="size-4 text-text-muted" /> Comentários de revisão
                  </button>
                )}
                <button type="button" disabled={improving} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-2 disabled:opacity-50" onClick={() => { onImprove(); setShowMore(false); }} title="Reformatar o texto em blocos ricos (IA)">
                  <Wand2 className="size-4 text-text-muted" />{" "}
                  {improving
                    ? "Melhorando…"
                    : selectedIds.length > 0
                      ? "Melhorar layout (seleção)"
                      : "Melhorar layout"}
                </button>
                <button type="button" className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-2" onClick={() => { setShowHistory(true); setShowMore(false); }}>
                  <History className="size-4 text-text-muted" /> Histórico de versões
                </button>
                <p className="px-2 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wider text-text-muted">Publicação</p>
                {canPublish && (
                  <button type="button" className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-2" onClick={() => { setShowSchedule(true); setShowMore(false); }} title="Publicar/despublicar em data e hora marcadas">
                    <CalendarClock className="size-4 text-text-muted" /> Agendar publicação
                  </button>
                )}
                {/* Saiu do lugar primário: um botão que tira o artigo do ar não
                    merece a posição mais clicável da tela. Aqui, com confirmação. */}
                {canPublish && status === "published" && (
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-2"
                    onClick={() => { void onUnpublish(); }}
                    title="Sai do portal e do chatbot; o conteúdo fica salvo como rascunho"
                  >
                    <EyeOff className="size-4 text-text-muted" /> Tirar do ar
                  </button>
                )}
                <p className="px-2 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wider text-text-muted">Escrever com IA</p>
                <button type="button" className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-2" onClick={() => { setShowChat(true); setShowOptimize(false); setShowMore(false); }} title="Converse com a IA: ela altera o artigo em tempo real (Ctrl+Z desfaz)">
                  <MessageSquareText className="size-4 text-text-muted" /> Chat IA (editar conversando)
                </button>
                <button type="button" className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-2" onClick={() => { setShowOptimize(true); setShowChat(false); setShowMore(false); }} title="Auditoria de qualidade e SEO deste artigo">
                  <Gauge className="size-4 text-text-muted" /> Otimizar (qualidade/SEO)
                </button>
                <button type="button" disabled={remixando !== null} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-2 disabled:opacity-50" onClick={() => { void onRemix("tldr"); setShowMore(false); }} title="Resumo executivo no topo do artigo (IA, com prévia)">
                  <Wand2 className="size-4 text-text-muted" /> {remixando === "tldr" ? "Resumindo…" : "Resumo TL;DR (IA)"}
                </button>
                <button type="button" disabled={remixando !== null} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-2 disabled:opacity-50" onClick={() => { void onRemix("faq"); setShowMore(false); }} title="Gera um artigo de FAQ a partir deste (IA, com prévia)">
                  <Wand2 className="size-4 text-text-muted" /> {remixando === "faq" ? "Gerando FAQ…" : "Gerar FAQ (IA)"}
                </button>
                <p className="px-2 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wider text-text-muted">Reaproveitar</p>
                <button type="button" className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-2" onClick={() => { onColar(); setShowMore(false); }} title="Cola ao fim deste artigo os blocos copiados/recortados de outro artigo">
                  <ClipboardPaste className="size-4 text-text-muted" /> Colar blocos (fim do artigo)
                </button>
                <button type="button" className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-2" onClick={() => { void onSalvarModelo(); setShowMore(false); }} title="Este artigo vira um modelo para novos artigos">
                  <LayoutTemplate className="size-4 text-text-muted" /> Salvar como modelo
                </button>
                {selectedId && (
                  <button type="button" className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-2" onClick={() => { void onSalvarSnippet(); setShowMore(false); }} title="O bloco selecionado vira um snippet reutilizável (editar nele atualiza em todos os artigos)">
                    <Repeat2 className="size-4 text-text-muted" /> Salvar bloco como snippet
                  </button>
                )}
                <p className="px-2 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wider text-text-muted">Manutenção</p>
                <button type="button" className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-2" onClick={() => { onReindex(); setShowMore(false); }}>
                  <Sparkles className="size-4 text-text-muted" /> Gerar embeddings
                </button>
                <button type="button" className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-2" onClick={() => { setShowShortcuts(true); setShowMore(false); }}>
                  <Keyboard className="size-4 text-text-muted" /> Atalhos do teclado
                </button>
                {canDelete && (
                  <>
                    <div className="my-1 border-t border-border" />
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm text-brand-pink-700 hover:bg-brand-pink-50 dark:text-brand-pink-400 dark:hover:bg-brand-pink-950/40"
                      onClick={() => { void onDeleteArticle(); }}
                      title="Enviar este artigo para a lixeira (restaurável em 30 dias)"
                    >
                      <Trash2 className="size-4" /> Excluir artigo
                    </button>
                  </>
                )}
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
          {/* O primário SÓ publica. Publicado e sem rascunho, não há o que
              fazer aqui — e um botão que só existe para desfazer não merece a
              posição mais clicável da tela. Despublicar foi para o menu ⋯. */}
          {canPublish && (status !== "published" || hasDraft) && (
            <Button onClick={onPublish}>{hasDraft ? "Publicar alterações" : "Publicar"}</Button>
          )}
          {/* "Enviar para revisão" aparecia SÓ para quem não pode publicar. Um
              editor sênior que quisesse uma segunda leitura não tinha como pedir
              — a opção existia e estava escondida justamente de quem escolheria
              usá-la. Agora é secundária para quem publica, primária para quem não. */}
          {status === "draft" && (
            <Button variant={canPublish ? "secondary" : "primary"} onClick={onSubmitReview}>
              Enviar para revisão
            </Button>
          )}
        </div>
      </div>

      {erroSalvar && (
        <p role="alert" className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">{erroSalvar}</p>
      )}

      {/* Só ocupa o topo quando o artigo está em revisão (ou aberto pelo menu
          Mais ações) — fora disso é uma faixa morta empurrando o canvas. */}
      {(status === "review" || showReview) && (
        <details className="mt-2 rounded-lg border border-border" open>
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-text-muted">Revisão e comentários</summary>
          <div className="border-t border-border p-3">
            <ReviewThread nodeId={nodeId} canComment={!!canComment} />
          </div>
        </details>
      )}

      {/* Corpo: canvas + painel de propriedades. O canvas usa o MESMO contexto
          tipográfico do portal (.prose prose-portal) para o que se edita
          aparecer idêntico ao que o usuário final vê. */}
      {!preview && nodeSlug !== undefined && (
        <MetadataCard
          key={`${title}:${nodeSlug}:${nodeDescription ?? ""}`}
          nodeId={nodeId}
          title={title}
          slug={nodeSlug}
          description={nodeDescription ?? null}
          icon={nodeIcon ?? null}
        />
      )}
      <div className="mt-3 flex min-h-0 flex-1 gap-6">
        {preview ? (
          <div className="flex-1 overflow-auto">
            <div className="mx-auto min-h-full max-w-[calc(65ch+3rem)] pl-12">
              <div
                className="leitura prose prose-neutral prose-portal max-w-none dark:prose-invert"
                data-size={readingSize}
              >
                <RenderBlocks blocks={blocks} snippets={noSnippets} headingShift={2} />
              </div>
            </div>
          </div>
        ) : (
          /* DndContext acima da bifurcação paleta/canvas: os draggables da
             paleta e os sortables dos blocos vivem no MESMO contexto — é o
             que permite arrastar da paleta para dentro do artigo. */
          <DndContext
            // Id fixo pelo mesmo motivo da árvore (ver `content/tree.tsx`).
            // Precisa ser DIFERENTE do dela: as duas convivem na mesma página.
            id="dnd-editor-blocos"
            sensors={sensors}
            collisionDetection={colisaoEditor}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            onDragCancel={() => {
              setDragPaleta(null);
              setDropLinha(null);
            }}
          >
            {/* Região "itens e objetos" (paleta de blocos). Fixa na altura,
                rola sozinha, redimensionável e recolhível. Com um painel direito
                aberto (Chat/Otimizar), vira trilho de ícones à força — nunca dois
                trilhos largos comendo o canvas ao mesmo tempo. */}
            {showChat || showOptimize ? (
              <aside className="slim-scroll flex w-12 shrink-0 flex-col items-center gap-1 overflow-y-auto rounded-lg border border-border bg-surface py-2">
                <PaletteRailIcons onAdd={paletteAdd} />
              </aside>
            ) : paleta.collapsed ? (
              <CollapsedRail side="left" onExpand={paleta.toggle} label="a paleta de blocos">
                <PaletteRailIcons onAdd={paletteAdd} />
              </CollapsedRail>
            ) : (
              <ResizablePanel storageKey="kb.paletteWidth" side="left" min={200} max={420} defaultWidth={240}>
                <aside className="slim-scroll h-full w-full overflow-y-auto rounded-xl border border-border bg-surface shadow-1">
                  <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-surface/95 px-3 py-2.5 backdrop-blur">
                    <span className="text-sm font-semibold">Blocos e objetos</span>
                    <CollapseButton side="left" onClick={paleta.toggle} label="a paleta de blocos" />
                  </div>
                  <div className="p-3">
                    <BlockPalette
                      onAdd={paletteAdd}
                      snippets={snippetsDisponiveis}
                      onAddSnippet={paletteAddSnippet}
                    />
                  </div>
                </aside>
              </ResizablePanel>
            )}
            <div
              className="min-w-[26rem] flex-1 overflow-auto"
              onClick={() => setSelectedId(null)}
              onContextMenu={onCanvasContextMenu}
            >
              {/* CARTÃO BRANCO da referência: os blocos vivem num card com a
                  calha das alças (pl-12) DENTRO dele. A medida de linha segue a
                  da leitura (65ch) + calha + p-8 — mesmo ponto de quebra do
                  portal. min-h garante área clicável abaixo do último bloco. */}
              <div className="mx-auto min-h-full max-w-[calc(65ch+3rem+3rem)] rounded-xl border border-border bg-surface p-8 pl-12 shadow-1">
                {/* `leitura` + data-size ligam a escala do tema (a MESMA da página
                    pública); `.editor-blocks` compacta o ritmo só na edição — a
                    prévia usa o espaçamento idêntico ao do portal. A lista de
                    blocos é uma coluna com gap-1.5 (catálogo Lumina). */}
                <div
                  className="leitura prose prose-neutral prose-portal editor-blocks flex max-w-none flex-col gap-1.5 dark:prose-invert"
                  data-size={readingSize}
                >
                  <BlockList
                    key={revisao}
                    blocks={blocks}
                    actions={actions}
                    selectedIds={selectedIds}
                    autoFocusId={autoFocusId}
                    spaceId={spaceId}
                    onContextMenu={(block, x, y) => setCtxMenu({ block, x, y })}
                    dropLinha={dropLinha}
                  />
                </div>
                <CanvasEndZone vazio={blocks.length === 0} />
              </div>
            </div>
            <DragOverlay>
              {dragPaleta && (
                <span className="inline-flex items-center gap-2 rounded-md border border-brand-purple-300 bg-surface px-3 py-2 text-sm font-semibold text-primary shadow-2">
                  <GripVertical className="size-4 text-brand-purple-400" />
                  {dragPaleta}
                </span>
              )}
            </DragOverlay>
          </DndContext>
        )}
        {!preview && showChat && (
          <EditorChat
            nodeId={nodeId}
            blocks={blocks}
            onApplyBlocks={(novo) => setBlocks(novo)}
            onMelhorarLayout={() => void onImprove()}
            temBlocoDeTextoSelecionado={!!aiTextoAlvo}
            acoesTexto={ACOES_IA_TEXTO.map((a) => ({
              rotulo: a.rotulo,
              onClick: () => void onAiTexto(a.acao, a.tom, a.rotulo),
            }))}
            onAcaoTexto={() => undefined}
            onClose={() => setShowChat(false)}
          />
        )}
        {!preview && !showChat && showOptimize && (
          <OptimizePanel
            nodeId={nodeId}
            spaceId={spaceId}
            title={title}
            description={nodeDescription ?? null}
            blocks={blocks}
            onSelectBlock={(id) => {
              actions.select(id);
              document
                .querySelector(`[data-block-id="${id}"]`)
                ?.scrollIntoView({ block: "center", behavior: "smooth" });
            }}
            onClose={() => setShowOptimize(false)}
          />
        )}
        {/* Região "propriedades do item selecionado" na direita — SÓ aparece ao
            selecionar um bloco (cede a vez para Chat/Otimizar). Fixa na altura,
            redimensionável e recolhível num trilho fino. */}
        {!preview && !showChat && !showOptimize && selectedId && (() => {
          const sel = findBlock(blocks, selectedId);
          if (!sel) return null;
          if (inspetor.collapsed) {
            const Icon = BLOCKS[sel.type].icon;
            return (
              <CollapsedRail side="right" onExpand={inspetor.toggle} label="as propriedades">
                <span
                  title={`Propriedades — ${BLOCKS[sel.type].label}`}
                  className="flex size-8 items-center justify-center rounded-lg border border-border bg-surface text-primary"
                >
                  <Icon className="size-4" />
                </span>
              </CollapsedRail>
            );
          }
          return (
            <ResizablePanel storageKey="kb.inspectorWidth" side="right" min={260} max={560} defaultWidth={320}>
              <BlockInspector
                block={sel}
                actions={actions}
                onFormat={(mark) => activeRT?.current?.toggleMark(mark)}
                onLink={() => activeRT?.current?.link()}
                onClose={() => setSelectedId(null)}
                onCollapse={inspetor.toggle}
              />
            </ResizablePanel>
          );
        })()}
      </div>

      {/* Barra flutuante de seleção — 1+ bloco: copiar/recortar sempre, agrupar
          a partir de 2 (shift/ctrl+clique). */}
      {!preview && !showChat && !showOptimize && selectedIds.length >= 1 && (
        <GroupBar
          count={selectedIds.length}
          onGroup={agrupar}
          onCopy={onCopiar}
          onCut={onRecortar}
          onSendToArticle={onEnviarParaArtigo}
          onClear={() => setSelectedIds([])}
        />
      )}

      {enviar && (
        <SendToArticleDialog
          blocks={enviar.blocks}
          onClose={() => setEnviar(null)}
          onDone={(mover) => {
            if (mover) {
              const set = new Set(enviar.tops);
              setBlocks((bs) => bs.filter((b) => !set.has(b.id)));
              setSelectedIds([]);
            }
            setEnviar(null);
          }}
        />
      )}

      {findOpen && !preview && (
        <FindReplaceBar
          query={findQuery}
          onQuery={(v) => {
            setFindQuery(v);
            setFindIndex(-1);
          }}
          replaceValue={findReplace}
          onReplaceValue={setFindReplace}
          caseSensitive={findCase}
          onToggleCase={() => {
            setFindCase((c) => !c);
            setFindIndex(-1);
          }}
          count={matches.length}
          current={findIndex >= 0 && findIndex < matches.length ? findIndex + 1 : 0}
          onPrev={() => irPara(findIndex - 1)}
          onNext={() => irPara(findIndex + 1)}
          onReplace={substituirAtual}
          onReplaceAll={substituirTudo}
          onClose={() => setFindOpen(false)}
        />
      )}

      <div className="mt-2 flex items-center justify-end border-t border-border pt-2 text-xs text-text-muted">
        <span className="tabular-nums">{words} palavra{words === 1 ? "" : "s"}</span>
      </div>

      {slash && (
        <SlashMenu
          rect={slash.rect}
          onSelect={onSlashSelect}
          onSelectChart={onSlashChart}
          onClose={() => setSlash(null)}
          snippets={snippetsDisponiveis}
          onSelectSnippet={onSlashSnippet}
        />
      )}

      {ctxMenu && (
        <BlockContextMenu
          block={ctxMenu.block}
          x={ctxMenu.x}
          y={ctxMenu.y}
          actions={actions}
          onClose={() => setCtxMenu(null)}
          onProperties={() => setSelectedId(ctxMenu.block.id)}
          onSendToArticle={() => onEnviarBlocoParaArtigo(ctxMenu.block.id)}
          selCount={selectedIds.includes(ctxMenu.block.id) ? selectedIds.length : 1}
        />
      )}

      {showShortcuts && <ShortcutsHelp onClose={() => setShowShortcuts(false)} />}

      {showHistory && (
        <HistoryPanel nodeId={nodeId} canRestore={!!canRestore} onClose={() => setShowHistory(false)} />
      )}

      {showSchedule && (
        <ScheduleDialog nodeId={nodeId} spaceId={spaceId} onClose={() => setShowSchedule(false)} />
      )}

      <Dialog
        open={!!layoutPerguntas}
        onClose={() => setLayoutPerguntas(null)}
        size="lg"
        title="Antes de reformatar, algumas escolhas"
        description="A IA leu o artigo e encontrou pontos com mais de uma formatação possível. Suas respostas direcionam o resultado — o texto continua intocado."
        footer={
          <>
            <Button variant="ghost" onClick={() => setLayoutPerguntas(null)}>
              Cancelar
            </Button>
            <Button
              variant="secondary"
              onClick={() => void rodarImprove(undefined)}
              title="Reformatar já, sem responder (comportamento padrão)"
            >
              Aplicar sem perguntas
            </Button>
            <Button
              disabled={Object.keys(layoutRespostas).length === 0}
              onClick={() =>
                void rodarImprove(
                  diretivasParaDirecao(
                    diretivasEscolhidas(layoutPerguntas ?? [], layoutRespostas),
                  ),
                )
              }
            >
              Continuar com minhas escolhas
            </Button>
          </>
        }
      >
        <div className="mb-4 rounded-lg border border-border p-3">
          <p className="mb-1.5 text-xs font-medium text-text-muted">Criatividade da IA</p>
          <CriatividadeSelect value={criatividade} onChange={setCriatividade} />
        </div>
        {layoutPerguntas && (
          <LayoutQuestionsForm
            perguntas={layoutPerguntas}
            respostas={layoutRespostas}
            onChange={setLayoutRespostas}
          />
        )}
      </Dialog>

      <Dialog
        open={!!remix}
        onClose={() => setRemix(null)}
        size="lg"
        title={remix?.tipo === "faq" ? "FAQ proposto" : "Resumo proposto"}
        description={
          remix?.tipo === "faq"
            ? "Revise: ao aplicar, vira um NOVO artigo (rascunho) ao lado deste."
            : "Revise: ao aplicar, o resumo entra no topo deste artigo."
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemix(null)}>
              Descartar
            </Button>
            <Button onClick={() => void applyRemix()}>
              {remix?.tipo === "faq" ? "Criar artigo de FAQ" : "Inserir no topo"}
            </Button>
          </>
        }
      >
        {remix && (
          <div
            className="leitura prose prose-neutral prose-portal max-h-[60vh] max-w-none overflow-auto dark:prose-invert"
            data-size={readingSize}
          >
            <RenderBlocks blocks={remix.blocks} snippets={new Map()} headingShift={2} />
          </div>
        )}
      </Dialog>

      <Dialog
        open={!!aiProposta}
        onClose={() => setAiProposta(null)}
        size="lg"
        title={
          aiProposta
            ? `IA no texto ${aiProposta.escopo === "artigo" ? "(artigo inteiro) " : aiProposta.escopo === "selecao" ? `(${aiProposta.blockIds?.length ?? 0} itens) ` : ""}— ${aiProposta.rotulo}`
            : "IA no texto"
        }
        description={
          aiProposta?.escopo === "artigo"
            ? "Nada é aplicado sem o seu aceite. ATENÇÃO: aplicar SUBSTITUI o conteúdo do artigo pelo texto reformulado em parágrafos — blocos ricos (imagens, tabelas, código) são removidos."
            : "Compare e decida. Nada é aplicado sem o seu aceite; a formatação em negrito/itálico do trecho antigo é substituída junto."
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setAiProposta(null)}>
              Descartar
            </Button>
            <Button onClick={applyAiTexto}>
              {aiProposta?.escopo === "artigo" ? "Aplicar no artigo" : "Aplicar no bloco"}
            </Button>
          </>
        }
      >
        {aiProposta && (
          <div className="grid max-h-[60vh] gap-3 overflow-auto sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
                Antes
              </p>
              <p className="whitespace-pre-wrap rounded-lg border border-border bg-surface-2 p-3 text-sm leading-relaxed">
                {aiProposta.original}
              </p>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                Proposta
              </p>
              <p className="whitespace-pre-wrap rounded-lg border border-primary/40 bg-brand-purple-50 p-3 text-sm leading-relaxed dark:bg-brand-purple-950/30">
                {aiProposta.proposta}
              </p>
            </div>
          </div>
        )}
      </Dialog>

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
          <div
            className="leitura prose prose-neutral prose-portal max-h-[60vh] max-w-none overflow-auto dark:prose-invert"
            data-size={readingSize}
          >
            <RenderBlocks blocks={proposed.blocks} snippets={new Map()} headingShift={2} />
          </div>
        )}
      </Dialog>

      {publicUrl && status === "published" && spacePublic && (
        <EmbedDialog
          open={embedOpen}
          onClose={() => setEmbedOpen(false)}
          url={publicUrl.replace("/docs/", "/embed/")}
          title={title}
          kind="article"
        />
      )}
    </div>
  );
}

/** Ícones de acesso rápido da paleta (trilho recolhido): clicar adiciona o
 *  bloco ao final. Reusado no trilho forçado (Chat/Otimizar) e no recolhido. */
function PaletteRailIcons({ onAdd }: { onAdd: (t: BlockType) => void }) {
  return (
    <>
      {slashBlocks().map((m) => {
        const Icon = m.icon;
        return (
          <button
            key={m.type}
            type="button"
            title={`${m.label} — adicionar ao final`}
            onClick={() => onAdd(m.type)}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-brand-purple-50 hover:text-primary dark:hover:bg-brand-purple-950/40"
          >
            <Icon className="size-4" />
          </button>
        );
      })}
    </>
  );
}

/** Zona de soltura final do canvas (padrão Lumina): alvo GRANDE para o
 *  arrasto de paleta + convite quando o documento está vazio. */
function CanvasEndZone({ vazio }: { vazio: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas-end" });
  return (
    <div
      ref={setNodeRef}
      className={`mt-4 flex h-20 items-center justify-center rounded-lg border-2 border-dashed text-sm transition-colors ${
        isOver
          ? "border-brand-purple-400 bg-brand-purple-50 text-primary dark:bg-brand-purple-950/40"
          : "border-border text-text-muted"
      }`}
    >
      {vazio
        ? "Comece arrastando blocos da paleta ao lado para montar o artigo"
        : "Solte aqui para adicionar ao final do artigo"}
    </div>
  );
}

/** Seletor compacto do nível de criatividade da IA (3 botões). */
function CriatividadeSelect({
  value,
  onChange,
}: {
  value: Criatividade;
  onChange: (c: Criatividade) => void;
}) {
  return (
    <div className="flex gap-1">
      {CRIATIVIDADES.map((c) => (
        <button
          key={c.key}
          type="button"
          title={c.hint}
          onClick={() => onChange(c.key)}
          className={`flex-1 rounded-md border px-1.5 py-1 text-2xs transition-colors ${
            value === c.key
              ? "border-primary bg-brand-purple-50 text-primary dark:bg-brand-purple-950/30"
              : "border-border text-text-muted hover:border-primary/50"
          }`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
