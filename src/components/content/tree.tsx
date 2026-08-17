"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragMoveEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CheckCircle2, ExternalLink, FileText, FilePlus, FoldVertical, Folder, FolderPlus, Link2, ListFilter, Minus, MoreHorizontal, Network, Pencil, Plus, Replace, Search, Shapes, Sparkles, Trash2, UnfoldVertical, Wand2, X } from "lucide-react";
import type { TreeNode } from "@/lib/content/tree";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import {
  createNode,
  deleteNode,
  deleteNodes,
  mergeArticles,
  moveNode,
  moveNodesToParent,
} from "@/app/(admin)/admin/(app)/conteudo/actions";
import { NodePropertiesDialog } from "./node-properties-dialog";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
import { useLoader } from "@/components/ui/loader";
import { useNav } from "@/components/admin/nav-progress";
import { publishSubtree } from "@/app/(admin)/admin/(app)/conteudo/article-actions";
import { enqueueOntologyScanJob } from "@/app/(admin)/admin/(app)/ontologia/actions";
import {
  flatten,
  planejarDrop,
  type DropZone,
  type FlatItem,
} from "./tree-utils";
import { TreeItem } from "./tree-item";
import { CopyToSpaceDialog } from "./copy-to-space-dialog";
import { Dialog } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { enqueueBulkProcessJob } from "@/app/(admin)/admin/(app)/conteudo/bulk-actions";
import { definirIconesDiretorios } from "@/app/(admin)/admin/(app)/conteudo/icon-actions";
import { GlobalFindReplace } from "./global-find-replace";
import { DropdownMenu, MenuItem, MenuCheckItem, MenuSeparator, MenuLabel } from "@/components/ui/menu";
import { BUILTIN_TEMPLATES } from "@/lib/blocks/templates";
import {
  getTemplateBlocks,
  listSavedTemplates,
  type TemplateOption,
} from "@/app/(admin)/admin/(app)/conteudo/template-actions";
import { saveArticle } from "@/app/(admin)/admin/(app)/conteudo/article-actions";
import type { SpaceInfo } from "@/lib/content/spaces";
import { Select } from "@/components/ui/select";

// Um degrau curto por nível (padrão Microsoft Learn): em árvores fundas a
// indentação larga é quem come a largura do título.
const INDENT = 14;

/** O nó (ou algum descendente) é o `id`? Decide se a exclusão fecha o editor. */
function subtreeTemId(n: TreeNode, id: string): boolean {
  return n.id === id || n.children.some((c) => subtreeTemId(c, id));
}

/**
 * Conjunto EFETIVO de nós "acesos": um artigo acende se está em `ids`; uma
 * pasta acende se qualquer descendente acende (a bolinha sobe pela árvore).
 */
function conjuntoEfetivo(nodes: TreeNode[], ids: string[]): Set<string> {
  const base = new Set(ids);
  const eff = new Set<string>();
  const walk = (n: TreeNode): boolean => {
    let algum = base.has(n.id);
    for (const c of n.children) if (walk(c)) algum = true;
    if (algum) eff.add(n.id);
    return algum;
  };
  nodes.forEach(walk);
  return eff;
}

/** Ids dos ARTIGOS com um dado status (draft/review) em toda a árvore. */
function artigosComStatus(nodes: TreeNode[], status: string): string[] {
  const ids: string[] = [];
  const walk = (list: TreeNode[]) => {
    for (const n of list) {
      if (n.type === "article" && n.status === status) ids.push(n.id);
      walk(n.children);
    }
  };
  walk(nodes);
  return ids;
}

/** Estados filtráveis da árvore (rótulo + bolinha de cor). */
const FILTRO_DEFS = [
  { key: "publicado", rotulo: "Publicados", cor: "bg-success" },
  { key: "rascunho", rotulo: "Rascunho", cor: "bg-brand-gray-400" },
  { key: "revisao", rotulo: "Aguardando aprovação", cor: "bg-warning" },
  { key: "embedding", rotulo: "Embedding", cor: "bg-info" },
  { key: "ontologia", rotulo: "Ontologia", cor: "bg-text-muted" },
] as const;
const FILTROS_VAZIO = { publicado: false, rascunho: false, revisao: false, embedding: false, ontologia: false };

export function Tree({
  spaceId,
  nodes: nodesProp,
  selectedId,
  spaces = [],
  siteUrl = "",
  embeddedIds = [],
  ontologyIds = [],
  pendingDraftIds = [],
}: {
  spaceId: string;
  /** Documentações disponíveis — habilita copiar/mover a seleção entre elas. */
  spaces?: SpaceInfo[];
  nodes: TreeNode[];
  /** Base do portal público — para o botão "abrir a documentação". */
  siteUrl?: string;
  selectedId?: string;
  /** IDs de artigos já indexados (embedding gerado) — acende a bolinha azul. */
  embeddedIds?: string[];
  /** IDs de artigos já varridos pela ontologia — acende a bolinha cinza. */
  ontologyIds?: string[];
  /** IDs de artigos com rascunho PENDENTE (edições não publicadas). */
  pendingDraftIds?: string[];
}) {
  const router = useRouter();
  const { confirmar, pedirTexto } = useConfirm();
  const toast = useToast();
  const loader = useLoader();
  const nav = useNav();
  // Espelho LOCAL da árvore: permite a reordenação OTIMISTA no drop (o item fica
  // ONDE foi solto, sem "voltar" enquanto o servidor confirma). Ressincroniza
  // quando o servidor manda dados novos — via ajuste de estado na renderização
  // (padrão do React "adjusting state on prop change"), não em effect.
  const [nodes, setNodes] = useState(nodesProp);
  const [nodesPropAnterior, setNodesPropAnterior] = useState(nodesProp);
  if (nodesProp !== nodesPropAnterior) {
    setNodesPropAnterior(nodesProp);
    setNodes(nodesProp);
  }
  // URL pública da documentação (mesma regra do SpacePublicUrl): domínio próprio
  // ou `${siteUrl}/docs/${slug}` — para o botão "abrir a documentação".
  const espacoAtual = spaces.find((s) => s.id === spaceId);
  const docsUrl = espacoAtual
    ? espacoAtual.custom_domain
      ? `https://${espacoAtual.custom_domain}`
      : `${siteUrl}/docs/${espacoAtual.slug}`
    : null;
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);
  // Busca por texto na árvore INTEIRA (autocomplete).
  const [busca, setBusca] = useState("");
  const [buscaSel, setBuscaSel] = useState(0);
  const [buscaAberta, setBuscaAberta] = useState(false);
  const buscaWrapRef = useRef<HTMLDivElement>(null);
  const storageKey = `kb.treeCollapsed.${spaceId}`;
  const [activeId, setActiveId] = useState<string | null>(null);
  // Alvo do drop no modelo por ZONA: item sob o cursor + região (antes/depois/dentro).
  const [drop, setDrop] = useState<{ overId: string; zone: DropZone } | null>(null);
  const pointerY0 = useRef(0); // Y do cursor no início do arraste (para calcular a zona)
  const expandTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [creating, setCreating] = useState<null | "folder" | "article">(null);
  const [propsNode, setPropsNode] = useState<TreeNode | null>(null);
  const [frOpen, setFrOpen] = useState(false);
  const [sendToSpace, setSendToSpace] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [bulkOpts, setBulkOpts] = useState({ publicar: true, embedding: true, ontologia: true });
  const [bulkAtivo, setBulkAtivo] = useState<{ phase: string | null; done: number; total: number; progress: number } | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [templateSel, setTemplateSel] = useState("none");
  const [salvos, setSalvos] = useState<TemplateOption[]>([]);
  const [pending, startTransition] = useTransition();

  const sensors = useSensors(
    // Distância maior evita "arrastar sem querer" ao clicar (que movia o item
    // e fazia a seleção perder a referência).
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } }),
  );

  // Conjunto EFETIVO: o artigo acende se marcado; a PASTA acende se qualquer
  // descendente acende — a bolinha (e o filtro) sobe pela árvore.
  const embeddedSet = useMemo(() => conjuntoEfetivo(nodes, embeddedIds), [nodes, embeddedIds]);
  const ontologySet = useMemo(() => conjuntoEfetivo(nodes, ontologyIds), [nodes, ontologyIds]);
  const publishedSet = useMemo(() => {
    const pub: string[] = [];
    const coleta = (list: TreeNode[]) => {
      for (const n of list) {
        if (n.status === "published") pub.push(n.id);
        coleta(n.children);
      }
    };
    coleta(nodes);
    return conjuntoEfetivo(nodes, pub);
  }, [nodes]);
  // "Rascunho" = artigo nunca publicado (status draft) OU com edições PENDENTES
  // (article_drafts). "Aguardando aprovação" = status review.
  const pendingSet = useMemo(() => new Set(pendingDraftIds), [pendingDraftIds]);
  const rascunhoIds = useMemo(() => {
    const s = new Set(artigosComStatus(nodes, "draft"));
    for (const id of pendingDraftIds) s.add(id);
    return [...s];
  }, [nodes, pendingDraftIds]);
  const rascunhoSet = useMemo(() => conjuntoEfetivo(nodes, rascunhoIds), [nodes, rascunhoIds]);
  const revisaoSet = useMemo(() => conjuntoEfetivo(nodes, artigosComStatus(nodes, "review")), [nodes]);

  // Filtro (item pedido): marca um ou mais tipos → mostra só quem os tem
  // (interseção); tudo desmarcado → mostra tudo. Ao filtrar, ignora o
  // recolhimento (tudo expandido) para os itens que casam ficarem visíveis.
  const [filtros, setFiltros] = useState({
    publicado: false,
    embedding: false,
    ontologia: false,
    rascunho: false,
    revisao: false,
  });
  const qtdFiltros = Object.values(filtros).filter(Boolean).length;
  const algumFiltro = qtdFiltros > 0;

  const flat = useMemo(() => {
    const base = flatten(nodes, algumFiltro ? new Set<string>() : collapsed);
    if (!algumFiltro) return base;
    return base.filter(
      (i) =>
        (!filtros.publicado || publishedSet.has(i.id)) &&
        (!filtros.embedding || embeddedSet.has(i.id)) &&
        (!filtros.ontologia || ontologySet.has(i.id)) &&
        (!filtros.rascunho || rascunhoSet.has(i.id)) &&
        (!filtros.revisao || revisaoSet.has(i.id)),
    );
  }, [nodes, collapsed, algumFiltro, filtros, publishedSet, embeddedSet, ontologySet, rascunhoSet, revisaoSet]);
  const ids = flat.map((i) => i.id);

  // ── Busca por texto na árvore INTEIRA (autocomplete) ──────────────────────
  const normalizarBusca = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  // TODOS os nós (ignora colapso/filtros — busca cobre a árvore inteira).
  const todosNos = useMemo(() => flatten(nodes, new Set<string>()), [nodes]);
  const noPorId = useMemo(() => new Map(todosNos.map((f) => [f.id, f])), [todosNos]);

  const caminhoDe = useCallback(
    (id: string): string => {
      const partes: string[] = [];
      const guarda = new Set<string>([id]);
      let p = noPorId.get(id)?.parentId ? noPorId.get(noPorId.get(id)!.parentId!) : undefined;
      while (p && !guarda.has(p.id)) {
        guarda.add(p.id);
        partes.unshift(p.node.title);
        p = p.parentId ? noPorId.get(p.parentId) : undefined;
      }
      return partes.join(" › ");
    },
    [noPorId],
  );

  const resultadosBusca = useMemo(() => {
    const q = normalizarBusca(busca.trim());
    if (!q) return [];
    return todosNos.filter((f) => normalizarBusca(f.node.title).includes(q)).slice(0, 50);
  }, [busca, todosNos]);

  // Fecha o autocomplete ao clicar fora.
  useEffect(() => {
    if (!buscaAberta) return;
    const onDoc = (e: MouseEvent) => {
      if (!buscaWrapRef.current?.contains(e.target as Node)) setBuscaAberta(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [buscaAberta]);

  /** Abre o resultado: expande os ancestrais (revela na árvore) e navega. */
  function abrirResultado(id: string) {
    setCollapsed((prev) => {
      const n = new Set(prev);
      const guarda = new Set<string>([id]);
      let p = noPorId.get(id)?.parentId ? noPorId.get(noPorId.get(id)!.parentId!) : undefined;
      while (p && !guarda.has(p.id)) {
        guarda.add(p.id);
        n.delete(p.id);
        p = p.parentId ? noPorId.get(p.parentId) : undefined;
      }
      return n;
    });
    setBusca("");
    setBuscaAberta(false);
    nav.navigate(`/admin/conteudo/${id}`, { scroll: false });
  }

  function onBuscaKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setBuscaSel((s) => Math.min(s + 1, resultadosBusca.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setBuscaSel((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = resultadosBusca[buscaSel];
      if (r) abrirResultado(r.id);
    } else if (e.key === "Escape") {
      setBusca("");
      setBuscaAberta(false);
    }
  }

  /** Título com o trecho casado realçado (índices batem: NFD preserva 1:1 no latim). */
  function realceTitulo(titulo: string) {
    const q = busca.trim();
    if (!q) return titulo;
    const i = normalizarBusca(titulo).indexOf(normalizarBusca(q));
    if (i < 0) return titulo;
    return (
      <>
        {titulo.slice(0, i)}
        <mark className="rounded bg-warning-soft text-text">
          {titulo.slice(i, i + q.length)}
        </mark>
        {titulo.slice(i + q.length)}
      </>
    );
  }

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem(storageKey, JSON.stringify([...next]));
      return next;
    });
  }

  /** Expande TODOS os diretórios (nada recolhido). */
  function expandirTudo() {
    setCollapsed(new Set());
    localStorage.setItem(storageKey, JSON.stringify([]));
  }

  /** Recolhe TODOS os diretórios (todo nó com filhos entra em `collapsed`). */
  function recolherTudo() {
    const ids: string[] = [];
    const walk = (list: TreeNode[]) => {
      for (const n of list) {
        if (n.children.length > 0) {
          ids.push(n.id);
          walk(n.children);
        }
      }
    };
    walk(nodes);
    setCollapsed(new Set(ids));
    localStorage.setItem(storageKey, JSON.stringify(ids));
  }

  // Recupera o que estava recolhido. Sem isto, navegar remonta a árvore e tudo
  // volta a aparecer expandido.
  useEffect(() => {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;
    try {
      const ids = JSON.parse(raw) as string[];
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setCollapsed(new Set(ids));
    } catch {
      /* estado inválido: ignora */
    }
  }, [storageKey]);

  // Progresso do processamento em lote (Realtime).
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("bulk-jobs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bulk_jobs", filter: `space_id=eq.${spaceId}` },
        (payload) => {
          const row = payload.new as {
            status: string;
            phase: string | null;
            done: number;
            total: number;
            progress: number;
            error: string | null;
          };
          if (row.status === "running" || row.status === "queued") {
            setBulkAtivo({ phase: row.phase, done: row.done, total: row.total, progress: row.progress });
          } else {
            setBulkAtivo(null);
            if (row.status === "done") toast.success("Processamento em lote concluído.");
            else if (row.status === "error") toast.error(row.error ?? "O processamento em lote falhou.");
            router.refresh();
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [spaceId, toast, router]);

  // Garante que o item selecionado esteja visível: abre só os ANCESTRAIS dele
  // (não mexe no resto) e rola o painel até ele — antes o scroll voltava ao topo.
  useEffect(() => {
    if (!selectedId) return;
    const caminho: string[] = [];
    const acha = (list: TreeNode[], trilha: string[]): boolean => {
      for (const n of list) {
        if (n.id === selectedId) {
          caminho.push(...trilha);
          // Pasta selecionada abre junto: quem clicou nela quer ver o que
          // há dentro, e o clique agora navega em vez de expandir.
          if (n.type === "folder") caminho.push(n.id);
          return true;
        }
        if (acha(n.children, [...trilha, n.id])) return true;
      }
      return false;
    };
    acha(nodes, []);

    if (caminho.length) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setCollapsed((prev) => {
        if (!caminho.some((id) => prev.has(id))) return prev; // já visível
        const next = new Set(prev);
        caminho.forEach((id) => next.delete(id));
        localStorage.setItem(storageKey, JSON.stringify([...next]));
        return next;
      });
    }

    // Dois quadros: o item pode ter acabado de ser revelado pela expansão acima,
    // então só depois do commit do React ele existe no DOM para receber o scroll.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        listRef.current
          ?.querySelector(`[data-node-id="${selectedId}"]`)
          ?.scrollIntoView({ block: "nearest" });
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [selectedId, nodes, storageKey]);

  /** Marca/desmarca um nó; com Shift, seleciona o intervalo desde o último. */
  function onCheck(id: string, e: React.MouseEvent) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      const ids = flat.map((i) => i.id);
      if (e.shiftKey && lastChecked) {
        const a = ids.indexOf(lastChecked);
        const b = ids.indexOf(id);
        if (a >= 0 && b >= 0) {
          const [lo, hi] = a < b ? [a, b] : [b, a];
          for (let i = lo; i <= hi; i++) next.add(ids[i]!);
        }
      } else if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setLastChecked(id);
  }

  function clearSelection() {
    setCheckedIds(new Set());
    setLastChecked(null);
  }

  const folders = flat.filter((i) => i.node.type === "folder");
  // Artigos selecionados, na ordem da árvore (para unificar em sequência).
  const selectedArticles = flat
    .filter((i) => checkedIds.has(i.id) && i.node.type === "article")
    .map((i) => i.id);

  // Diálogos filhos devolvem uma frase que pode ser sucesso ("Copiado: 3 itens…")
  // ou erro; o tom segue o conteúdo, como a faixa antiga fazia.
  function notify(m: string) {
    if (/falha|erro|sem permiss|inválid|não é possível/i.test(m)) toast.error(m);
    else toast.success(m);
  }

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "Falha.");
      router.refresh();
    });
  }

  function processarSelecao() {
    const ids = [...checkedIds];
    if (!ids.length || !(bulkOpts.publicar || bulkOpts.embedding || bulkOpts.ontologia)) return;
    startTransition(async () => {
      const r = await enqueueBulkProcessJob({
        spaceId,
        nodeIds: ids,
        publish: bulkOpts.publicar,
        embedding: bulkOpts.embedding,
        ontology: bulkOpts.ontologia,
      });
      if (r.ok) {
        toast.success("Processamento enfileirado — roda em segundo plano.");
        setShowBulk(false);
        clearSelection();
      } else {
        toast.error(r.error);
      }
    });
  }

  /** Publica DE UMA VEZ todos os artigos em rascunho da documentação (segundo plano). */
  async function publicarRascunhos() {
    if (!rascunhoIds.length) return;
    const ok = await confirmar({
      title: `Publicar ${rascunhoIds.length} rascunho${rascunhoIds.length === 1 ? "" : "s"}?`,
      description:
        "Todos os artigos em rascunho vão ao ar (os embeddings são gerados junto), em segundo plano. Não inclui os que estão aguardando aprovação.",
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await enqueueBulkProcessJob({
        spaceId,
        nodeIds: rascunhoIds,
        publish: true,
        embedding: false,
        ontology: false,
      });
      if (r.ok) toast.success(`${rascunhoIds.length} rascunho(s) na fila de publicação — segundo plano.`);
      else toast.error(r.error);
    });
  }

  /** Define um ícone para cada diretório SEM ícone, pelo contexto (IA + heurística). */
  async function definirIcones() {
    const ok = await confirmar({
      title: "Definir ícones dos diretórios?",
      description:
        "A IA analisa o título de cada diretório e os títulos dos artigos dentro dele e escolhe um ícone para cada pasta que ainda não tem um. Ícones já definidos não são alterados. Pode levar alguns instantes.",
      confirmLabel: "Definir ícones",
    });
    if (!ok) return;
    await loader.during("Analisando os diretórios e definindo ícones…", async () => {
      const r = await definirIconesDiretorios(spaceId);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      if (r.definidos === 0) {
        toast.info(
          r.total === 0
            ? "Todos os diretórios já têm ícone."
            : "Não foi possível sugerir ícones agora.",
        );
        return;
      }
      toast.success(
        `${r.definidos} diretório(s) receberam ícone${r.comIa ? " (por IA)" : " (por contexto)"}.`,
      );
      router.refresh();
    });
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
    const ae = e.activatorEvent as { clientY?: number };
    pointerY0.current = ae?.clientY ?? 0;
    setDrop(null);
  }
  // Modelo por ZONA: a posição do cursor DENTRO da linha-alvo decide a ação —
  // topo/base = irmão antes/depois; meio de uma PASTA = dentro dela. Sem arrasto
  // lateral (a causa dos aninhamentos indevidos).
  function onDragMove(e: DragMoveEvent) {
    const over = e.over;
    if (!over || String(over.id) === activeId) {
      setDrop(null);
      return;
    }
    const overId = String(over.id);
    const rect = over.rect;
    const pointerY = pointerY0.current + e.delta.y;
    const rel = rect.height ? (pointerY - rect.top) / rect.height : 0.5;
    const ehPasta = noPorId.get(overId)?.node.type === "folder";
    const zone: DropZone = ehPasta
      ? rel < 0.3
        ? "before"
        : rel > 0.7
          ? "after"
          : "inside"
      : rel < 0.5
        ? "before"
        : "after";
    setDrop((atual) => (atual?.overId === overId && atual.zone === zone ? atual : { overId, zone }));
  }
  function onDragEnd() {
    const active = activeId;
    const alvo = drop;
    resetDrag();
    if (!active || !alvo) return;
    const plano = planejarDrop(nodes, active, alvo.overId, alvo.zone);
    if (!plano) return;
    // OTIMISTA: aplica a nova árvore já (o item fica onde caiu, sem "voltar").
    // O `router.refresh` da mutação reconcilia — se deu certo, é a MESMA ordem.
    setNodes(plano.tree);
    run(() =>
      moveNode({
        id: active,
        newParentId: plano.parentId,
        prevPosition: plano.prev,
        nextPosition: plano.next,
      }),
    );
  }
  function resetDrag() {
    if (expandTimer.current) {
      clearTimeout(expandTimer.current);
      expandTimer.current = null;
    }
    setActiveId(null);
    setDrop(null);
  }

  const hasChildrenMap = useMemo(() => {
    const m = new Map<string, boolean>();
    const walk = (list: TreeNode[]) => {
      for (const n of list) {
        m.set(n.id, n.children.length > 0);
        walk(n.children);
      }
    };
    walk(nodes);
    return m;
  }, [nodes]);

  // Auto-expandir a pasta-alvo SÓ quando o cursor está DENTRO dela (zone
  // "inside") e ela está colapsada — para ver onde o item vai cair. Passar entre
  // itens (before/after) nunca expande nada.
  useEffect(() => {
    if (expandTimer.current) {
      clearTimeout(expandTimer.current);
      expandTimer.current = null;
    }
    if (!drop || drop.zone !== "inside") return;
    const alvo = drop.overId;
    if (!collapsed.has(alvo) || !(hasChildrenMap.get(alvo) ?? false)) return;
    expandTimer.current = setTimeout(() => {
      setCollapsed((prev) => {
        const n = new Set(prev);
        n.delete(alvo);
        return n;
      });
    }, 450);
  }, [drop, collapsed, hasChildrenMap]);

  function rowActions(item: FlatItem) {
    const isContainer = item.node.type === "folder";
    return (
      <>
        {isContainer && (
          <>
            <button
              type="button"
              title="Nova pasta"
              className="rounded p-1 text-text-muted hover:bg-surface hover:text-text"
              onClick={async () => {
                const title = await pedirTexto({
                  title: "Nova pasta",
                  label: "Nome da pasta",
                  placeholder: "Ex.: Cadastros",
                });
                if (title)
                  run(() =>
                    createNode({ spaceId, parentId: item.id, type: "folder", title }),
                  );
              }}
            >
              <FolderPlus className="size-3.5" />
            </button>
            <button
              type="button"
              title="Novo artigo"
              className="rounded p-1 text-text-muted hover:bg-surface hover:text-text"
              onClick={async () => {
                const title = await pedirTexto({
                  title: "Novo artigo",
                  label: "Título do artigo",
                  placeholder: "Ex.: Como abrir um chamado",
                });
                if (title)
                  run(() =>
                    createNode({ spaceId, parentId: item.id, type: "article", title }),
                  );
              }}
            >
              <FilePlus className="size-3.5" />
            </button>
            <button
              type="button"
              title="Criar com IA dentro desta pasta (Estúdio)"
              className="rounded p-1 text-text-muted hover:bg-surface hover:text-primary"
              onClick={() =>
                router.push(`/admin/estudio?space=${spaceId}&parent=${item.id}&nova=1`)
              }
            >
              <Wand2 className="size-3.5" />
            </button>
            <button
              type="button"
              title="Publicar tudo"
              className="rounded p-1 text-text-muted hover:bg-surface hover:text-primary"
              onClick={async () => {
                if (
                  await confirmar({
                    title: "Publicar tudo",
                    description: `Publicar "${item.node.title}" e TODOS os artigos dentro? O portal público muda agora.`,
                    confirmLabel: "Publicar",
                  })
                )
                  run(() =>
                    loader.during("Publicando o diretório…", async () => {
                      const r = await publishSubtree(item.id);
                      return r.ok ? { ok: true } : { ok: false, error: r.error };
                    }),
                  );
              }}
            >
              <CheckCircle2 className="size-3.5" />
            </button>
            <button
              type="button"
              title="Gerar embeddings (pasta toda)"
              className="rounded p-1 text-text-muted hover:bg-surface hover:text-primary"
              onClick={() =>
                router.push(`/admin/importar?aba=embeddings&space=${spaceId}&node=${item.id}`)
              }
            >
              <Sparkles className="size-3.5" />
            </button>
            <button
              type="button"
              title="Gerar ontologia (pasta toda) — roda em segundo plano"
              className="rounded p-1 text-text-muted hover:bg-surface hover:text-primary"
              onClick={() =>
                run(async () => {
                  const r = await enqueueOntologyScanJob({ spaceId, nodeId: item.id, nodeType: "folder" });
                  if (r.ok) toast.success("Varredura de ontologia enfileirada (segundo plano).");
                  return r.ok ? { ok: true } : { ok: false, error: r.error };
                })
              }
            >
              <Network className="size-3.5" />
            </button>
          </>
        )}
        <button
          type="button"
          title="Propriedades (nome, URL, ícone, descrição)"
          className="rounded p-1 text-text-muted hover:bg-surface hover:text-text"
          onClick={() => setPropsNode(item.node)}
        >
          <Pencil className="size-3.5" />
        </button>
        <button
          type="button"
          title="Excluir"
          className="rounded p-1 text-text-muted hover:bg-surface hover:text-brand-pink-700"
          onClick={async () => {
            if (
              await confirmar({
                title: "Excluir",
                description: `Excluir "${item.node.title}" e tudo dentro? Vai para a lixeira e pode ser restaurado em 30 dias.`,
                tone: "danger",
              })
            ) {
              // O nó aberto na área de edição foi junto? Sai da rota dele —
              // senão o editor continuava exibindo o conteúdo excluído.
              const fechaEditor = !!selectedId && subtreeTemId(item.node, selectedId);
              run(async () => {
                const r = await deleteNode(item.id);
                if (r.ok && fechaEditor) router.push("/admin/conteudo", { scroll: false });
                return r;
              });
            }
          }}
        >
          <Trash2 className="size-3.5" />
        </button>
      </>
    );
  }

  return (
    <div ref={listRef}>
      <div className="mb-2">
        {/* Cabeçalho compacto: um "Novo" agrupa as criações; "Filtrar" e o
            "⋯" recolhem o resto — cabe na coluna estreita sem estourar. */}
        <div className="flex items-center gap-1.5">
          <DropdownMenu label="Novo" icon={Plus} variant="primary" size="sm" align="start" panelWidth={200} title="Criar pasta, artigo ou com IA">
            {(close) => (
              <>
                <MenuItem icon={FolderPlus} onClick={() => { close(); setCreating("folder"); setDraftTitle(""); }}>
                  Pasta
                </MenuItem>
                <MenuItem
                  icon={FilePlus}
                  onClick={() => {
                    close();
                    setCreating("article");
                    setDraftTitle("");
                    setTemplateSel("none");
                    void listSavedTemplates(spaceId).then(setSalvos);
                  }}
                >
                  Artigo
                </MenuItem>
                <MenuSeparator />
                <MenuItem icon={Wand2} onClick={() => { close(); router.push(`/admin/estudio?space=${spaceId}&nova=1`); }}>
                  Criar com IA
                </MenuItem>
              </>
            )}
          </DropdownMenu>

          <div className="ml-auto flex items-center gap-1.5">
            {docsUrl && (
              <Button asChild size="icon" variant="ghost" title="Abrir a documentação publicada em uma nova aba">
                <a href={docsUrl} target="_blank" rel="noopener noreferrer" aria-label="Abrir a documentação publicada">
                  <ExternalLink className="size-4" />
                </a>
              </Button>
            )}
            <DropdownMenu
              label="Filtrar"
              icon={ListFilter}
              variant="secondary"
              size="sm"
              align="end"
              panelWidth={232}
              title="Filtrar a árvore por estado"
              badge={
                qtdFiltros > 0 ? (
                  <span className="inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-primary px-1 text-2xs font-bold leading-4 text-white">
                    {qtdFiltros}
                  </span>
                ) : undefined
              }
            >
              {() => (
                <>
                  <MenuLabel>Mostrar só</MenuLabel>
                  {FILTRO_DEFS.map((f) => (
                    <MenuCheckItem
                      key={f.key}
                      checked={filtros[f.key]}
                      dot={f.cor}
                      onClick={() => setFiltros((p) => ({ ...p, [f.key]: !p[f.key] }))}
                    >
                      {f.rotulo}
                    </MenuCheckItem>
                  ))}
                  {algumFiltro && (
                    <>
                      <MenuSeparator />
                      <MenuItem icon={X} onClick={() => setFiltros(FILTROS_VAZIO)}>
                        Limpar filtros
                      </MenuItem>
                    </>
                  )}
                </>
              )}
            </DropdownMenu>

            <DropdownMenu icon={MoreHorizontal} chevron={false} variant="ghost" size="icon" align="end" panelWidth={248} title="Mais ações">
              {(close) => (
                <>
                  {rascunhoIds.length > 0 && (
                    <>
                      <MenuItem
                        icon={CheckCircle2}
                        hint={rascunhoIds.length}
                        disabled={pending}
                        onClick={() => { close(); publicarRascunhos(); }}
                      >
                        Publicar rascunhos
                      </MenuItem>
                      <MenuSeparator />
                    </>
                  )}
                  <MenuItem icon={Replace} onClick={() => { close(); setFrOpen(true); }}>
                    Localizar e substituir
                  </MenuItem>
                  <MenuItem icon={Shapes} onClick={() => { close(); void definirIcones(); }}>
                    Definir ícones dos diretórios
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem icon={UnfoldVertical} onClick={() => { close(); expandirTudo(); }}>
                    Expandir todos
                  </MenuItem>
                  <MenuItem icon={FoldVertical} onClick={() => { close(); recolherTudo(); }}>
                    Recolher todos
                  </MenuItem>
                </>
              )}
            </DropdownMenu>
          </div>
        </div>

        {/* Busca com autocomplete na árvore INTEIRA. */}
        <div ref={buscaWrapRef} className="relative mt-2">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
          <input
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setBuscaAberta(true);
              setBuscaSel(0);
            }}
            onFocus={() => setBuscaAberta(true)}
            onKeyDown={onBuscaKey}
            placeholder="Buscar na árvore…"
            aria-label="Buscar na árvore"
            className={`${controlClass} h-8 w-full pl-8 pr-7 text-sm`}
          />
          {busca && (
            <button
              type="button"
              onClick={() => {
                setBusca("");
                setBuscaAberta(false);
              }}
              aria-label="Limpar busca"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-text-muted hover:bg-surface-2 hover:text-text"
            >
              <X className="size-3.5" />
            </button>
          )}

          {buscaAberta && busca.trim() && (
            <div className="absolute inset-x-0 top-full z-30 mt-1 max-h-[22rem] overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-2">
              {resultadosBusca.length === 0 ? (
                <p className="px-2 py-3 text-center text-xs text-text-muted">
                  Nada encontrado para “{busca.trim()}”.
                </p>
              ) : (
                <ul>
                  {resultadosBusca.map((f, i) => {
                    const Icone =
                      f.node.type === "folder"
                        ? Folder
                        : f.node.type === "article"
                          ? FileText
                          : f.node.type === "link"
                            ? Link2
                            : Minus;
                    const caminho = caminhoDe(f.id);
                    return (
                      <li key={f.id}>
                        <button
                          type="button"
                          onMouseEnter={() => setBuscaSel(i)}
                          onClick={() => abrirResultado(f.id)}
                          className={cn(
                            "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                            i === buscaSel ? "bg-surface-2" : "hover:bg-surface-2",
                          )}
                        >
                          <Icone className="mt-0.5 size-4 shrink-0 text-text-muted" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[0.8125rem] text-text">
                              {realceTitulo(f.node.title)}
                            </span>
                            {caminho && (
                              <span className="block truncate text-2xs text-text-muted">{caminho}</span>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Filtros ativos como chips removíveis — só aparecem quando há filtro. */}
        {algumFiltro && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {FILTRO_DEFS.filter((f) => filtros[f.key]).map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFiltros((p) => ({ ...p, [f.key]: false }))}
                title="Remover filtro"
                className="inline-flex items-center gap-1.5 rounded-full border border-primary bg-brand-purple-50 py-0.5 pl-2 pr-1.5 text-xs font-medium text-primary transition-colors hover:bg-brand-purple-100 dark:bg-brand-purple-950/40 dark:hover:bg-brand-purple-950/60"
              >
                <span className={cn("size-1.5 rounded-full", f.cor)} />
                {f.rotulo}
                <X className="size-3.5" />
              </button>
            ))}
            <button
              type="button"
              onClick={() => setFiltros(FILTROS_VAZIO)}
              className="rounded px-1.5 py-0.5 text-xs text-text-muted hover:text-text"
            >
              limpar
            </button>
          </div>
        )}
        {creating && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const title = draftTitle.trim();
              const tipo = creating;
              const modelo = templateSel;
              if (title && tipo) {
                run(async () => {
                  const r = await createNode({ spaceId, parentId: null, type: tipo, title });
                  if (r.ok && r.id && tipo === "article" && modelo !== "none") {
                    // Modelo escolhido: aplica os blocos e abre direto no editor.
                    const builtin = BUILTIN_TEMPLATES.find((t) => `builtin:${t.key}` === modelo);
                    const blocks = builtin ? builtin.blocks() : await getTemplateBlocks(modelo);
                    if (blocks.length) await saveArticle(r.id, { version: 2, blocks });
                    nav.navigate(`/admin/conteudo/${r.id}`);
                  }
                  return r;
                });
              }
              setCreating(null);
              setDraftTitle("");
            }}
            className="mt-2 flex items-center gap-2 rounded-lg border border-primary/40 bg-brand-purple-50 p-1.5 dark:bg-brand-purple-950/30"
          >
            {creating === "folder" ? (
              <FolderPlus className="size-4 shrink-0 text-primary" />
            ) : (
              <FilePlus className="size-4 shrink-0 text-primary" />
            )}
            <input
              autoFocus
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setCreating(null)}
              placeholder={creating === "folder" ? "Nome da pasta" : "Título do artigo"}
              className={cn(controlClass, "h-7 min-w-0 flex-1 px-2 py-1")}
            />
            {creating === "article" && (
              <Select
                value={templateSel}
                onChange={(v) => setTemplateSel(v)}
                aria-label="Modelo do artigo"
                title="Modelo inicial do artigo"
                className={cn(controlClass, "h-7 w-auto max-w-36 shrink-0 px-1 py-1 text-xs")}
              >
                <option value="none">Em branco</option>
                {BUILTIN_TEMPLATES.map((t) => (
                  <option key={t.key} value={`builtin:${t.key}`}>
                    {t.name}
                  </option>
                ))}
                {salvos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            )}
            <Button type="submit" size="sm" className="h-7 shrink-0">
              Criar
            </Button>
            <button
              type="button"
              onClick={() => setCreating(null)}
              className="shrink-0 rounded px-1.5 py-1 text-xs text-text-muted hover:text-text"
            >
              Cancelar
            </button>
          </form>
        )}
      </div>

      {bulkAtivo && (
        <div className="mb-2 rounded-md border border-border bg-surface-2 px-2.5 py-2 text-xs">
          <div className="flex items-center justify-between text-text-muted">
            <span>
              Processando em segundo plano
              {bulkAtivo.phase ? ` · ${bulkAtivo.phase}` : ""}…
            </span>
            <span className="tabular-nums">
              {bulkAtivo.total ? `${bulkAtivo.done}/${bulkAtivo.total}` : "iniciando…"}
            </span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface">
            <div className="h-full bg-primary transition-[width]" style={{ width: `${bulkAtivo.progress}%` }} />
          </div>
        </div>
      )}

      {checkedIds.size > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-primary/40 bg-brand-purple-50 px-2 py-1.5 text-sm dark:bg-brand-purple-950/30">
          <span className="font-medium text-primary">{checkedIds.size} selecionado(s)</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            title="Publicar / gerar embeddings / gerar ontologia da seleção, em fila e em segundo plano"
            onClick={() => setShowBulk(true)}
          >
            <Sparkles className="size-4" /> Processar
          </Button>
          {/* Controlado com value="" — volta sozinho ao rótulo depois de mover (o
              nativo precisava zerar o campo na mão). Com filtro: numa árvore de
              centenas de pastas, rolar até a pasta certa era o gargalo. */}
          <Select
            value=""
            className={cn("h-7 w-auto px-1 py-1 text-xs")}
            aria-label="Mover para"
            placeholder="Mover para…"
            buscaPlaceholder="Digite o nome da pasta…"
            options={[
              { value: "__root__", label: "Raiz" },
              ...folders
                .filter((f) => !checkedIds.has(f.id))
                .map((f) => ({ value: f.id, label: `${"— ".repeat(f.depth)}${f.node.title}` })),
            ]}
            onChange={(dest) => {
              if (!dest) return;
              const ids = [...checkedIds];
              run(async () => {
                const r = await moveNodesToParent(ids, dest === "__root__" ? null : dest);
                clearSelection();
                return r;
              });
            }}
          />
          {selectedArticles.length >= 2 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              title="Unificar os artigos selecionados em um só, na ordem da árvore"
              onClick={async () => {
                if (
                  await confirmar({
                    title: "Unificar artigos",
                    description: `Unificar ${selectedArticles.length} artigos em um só, na ordem da árvore? Os originais vão para a lixeira.`,
                    confirmLabel: "Unificar",
                  })
                ) {
                  const ids = selectedArticles;
                  run(async () => {
                    const r = await mergeArticles(ids);
                    clearSelection();
                    if (r.ok && r.id) nav.navigate(`/admin/conteudo/${r.id}`);
                    return r;
                  });
                }
              }}
            >
              Unificar ({selectedArticles.length})
            </Button>
          )}
          {spaces.length > 1 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              title="Copiar ou mover os itens marcados para outra documentação"
              onClick={() => setSendToSpace(true)}
            >
              Outra documentação
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            title="Abrir a gestão de embeddings desta documentação"
            onClick={() => router.push(`/admin/importar?aba=embeddings&space=${spaceId}`)}
          >
            Gerar embeddings
          </Button>
          <Button
            type="button"
            size="sm"
            variant="danger"
            onClick={async () => {
              if (
                await confirmar({
                  title: "Excluir selecionados",
                  description: `Excluir ${checkedIds.size} item(ns) e tudo dentro? Vão para a lixeira e podem ser restaurados em 30 dias.`,
                  tone: "danger",
                })
              ) {
                const ids = [...checkedIds];
                const fechaEditor =
                  !!selectedId &&
                  flat.some((i) => ids.includes(i.id) && subtreeTemId(i.node, selectedId));
                run(async () => {
                  const r = await deleteNodes(ids);
                  clearSelection();
                  if (r.ok && fechaEditor) router.push("/admin/conteudo", { scroll: false });
                  return r;
                });
              }
            }}
          >
            Excluir
          </Button>
          <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={clearSelection}>
            Limpar
          </Button>
        </div>
      )}

      {propsNode && (
        <NodePropertiesDialog
          node={propsNode}
          onClose={() => setPropsNode(null)}
          onDone={(m) => {
            if (m) notify(m);
            router.refresh();
          }}
        />
      )}

      <GlobalFindReplace spaceId={spaceId} open={frOpen} onClose={() => setFrOpen(false)} />

      {sendToSpace && (
        <CopyToSpaceDialog
          nodeIds={[...checkedIds]}
          currentSpaceId={spaceId}
          spaces={spaces}
          onClose={() => setSendToSpace(false)}
          onDone={(m) => {
            notify(m);
            clearSelection();
          }}
        />
      )}

      <Dialog
        open={showBulk}
        onClose={() => setShowBulk(false)}
        title="Processar seleção em segundo plano"
        description={`${checkedIds.size} item(ns). O worker faz na ordem: primeiro TODAS as publicações, depois os embeddings, por último a ontologia — um item de cada vez. Você não precisa abrir a tela de cada processo.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowBulk(false)}>
              Cancelar
            </Button>
            <Button
              onClick={processarSelecao}
              disabled={!(bulkOpts.publicar || bulkOpts.embedding || bulkOpts.ontologia)}
            >
              Enfileirar
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          {([
            { key: "publicar", rotulo: "Publicar", hint: "Publica os artigos (já gera os embeddings junto)." },
            { key: "embedding", rotulo: "Gerar embeddings", hint: "Regera os vetores de busca dos artigos." },
            { key: "ontologia", rotulo: "Gerar ontologia", hint: "Lê os artigos e sugere termos + sinônimos." },
          ] as const).map((o) => (
            <label key={o.key} className="flex items-start gap-2.5 rounded-lg border border-border p-2.5 text-sm">
              <input
                type="checkbox"
                checked={bulkOpts[o.key]}
                onChange={(e) => setBulkOpts((p) => ({ ...p, [o.key]: e.target.checked }))}
                className="mt-0.5 accent-[var(--color-primary)]"
              />
              <span>
                <span className="font-medium">{o.rotulo}</span>
                <span className="block text-xs leading-relaxed text-text-muted">{o.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </Dialog>

      {flat.length === 0 ? (
        <EmptyState
          className="mt-2"
          icon={FolderPlus}
          title="Árvore vazia"
          description="Crie uma pasta ou artigo para começar."
        />
      ) : (
        <DndContext
          // Id FIXO, obrigatório sob SSR: sem ele o dnd-kit deriva o
          // `aria-describedby` de um contador em escopo de módulo
          // (`useUniqueId`), que no servidor sobrevive entre requisições e no
          // cliente começa do zero — hidratação quebrada.
          // Vira um id de DOM literal (sem prefixo), então precisa ser único
          // na página inteira. Coberto por `ssr-dnd-ids.test.tsx`.
          id="dnd-arvore-conteudo"
          sensors={sensors}
          // `over` = a linha SOB O CURSOR (não a mais próxima do item) — casa com
          // o cálculo da zona (topo/meio/base) pela posição do cursor na linha.
          collisionDetection={pointerWithin}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
          onDragCancel={resetDrag}
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            {flat.map((item) => (
              <TreeItem
                key={item.id}
                id={item.id}
                node={item.node}
                depth={item.depth}
                collapsed={collapsed.has(item.id)}
                hasChildren={hasChildrenMap.get(item.id) ?? false}
                hasEmbedding={embeddedSet.has(item.id)}
                hasOntology={ontologySet.has(item.id)}
                hasPendingDraft={pendingSet.has(item.id)}
                dropBefore={drop?.overId === item.id && drop.zone === "before"}
                dropAfter={drop?.overId === item.id && drop.zone === "after"}
                dropInside={drop?.overId === item.id && drop.zone === "inside"}
                selected={item.id === selectedId}
                checked={checkedIds.has(item.id)}
                anyChecked={checkedIds.size > 0}
                indentationWidth={INDENT}
                onToggle={() => toggle(item.id)}
                onCheck={(e) => onCheck(item.id, e)}
                onSelect={(e) => {
                  // Shift = intervalo, Ctrl/⌘ = marcar avulso — sem navegar.
                  if (e.shiftKey || e.metaKey || e.ctrlKey) {
                    e.preventDefault();
                    onCheck(item.id, e);
                    return;
                  }
                  // Pasta também tem tela (ícone/descrição do card, resumo);
                  // expandir/recolher fica só na setinha.
                  if (item.node.type === "article" || item.node.type === "folder")
                    nav.navigate(`/admin/conteudo/${item.id}`, { scroll: false });
                  else toggle(item.id);
                }}
              >
                {rowActions(item)}
              </TreeItem>
            ))}
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
