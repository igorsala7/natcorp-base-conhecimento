"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragMoveEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CheckCircle2, FilePlus, FolderPlus, Pencil, Sparkles, Trash2 } from "lucide-react";
import type { TreeNode } from "@/lib/content/tree";
import { Button } from "@/components/ui/button";
import {
  createNode,
  deleteNode,
  deleteNodes,
  mergeArticles,
  moveNode,
  moveNodesToParent,
} from "@/app/(admin)/admin/(app)/conteudo/actions";
import { NodePropertiesDialog } from "./node-properties-dialog";
import { publishSubtree, reindexSubtreeEmbeddings } from "@/app/(admin)/admin/(app)/conteudo/article-actions";
import {
  flatten,
  getProjection,
  siblingPositions,
  type FlatItem,
} from "./tree-utils";
import { TreeItem } from "./tree-item";
import { CopyToSpaceDialog } from "./copy-to-space-dialog";
import type { SpaceInfo } from "@/lib/content/spaces";

const INDENT = 20;

export function Tree({
  spaceId,
  nodes,
  selectedId,
  spaces = [],
}: {
  spaceId: string;
  /** Documentações disponíveis — habilita copiar/mover a seleção entre elas. */
  spaces?: SpaceInfo[];
  nodes: TreeNode[];
  selectedId?: string;
}) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);
  const storageKey = `kb.treeCollapsed.${spaceId}`;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [offsetLeft, setOffsetLeft] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [creating, setCreating] = useState<null | "folder" | "article">(null);
  const [propsNode, setPropsNode] = useState<TreeNode | null>(null);
  const [sendToSpace, setSendToSpace] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    // Distância maior evita "arrastar sem querer" ao clicar (que movia o item
    // e fazia a seleção perder a referência).
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } }),
  );

  const flat = useMemo(
    () => flatten(nodes, collapsed),
    [nodes, collapsed],
  );
  const ids = flat.map((i) => i.id);

  const projected =
    activeId && overId
      ? getProjection(flat, activeId, overId, offsetLeft, INDENT)
      : null;

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem(storageKey, JSON.stringify([...next]));
      return next;
    });
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

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setMessage(res.error ?? "Falha.");
      else setMessage(null);
      router.refresh();
    });
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
    setOverId(String(e.active.id));
  }
  function onDragMove(e: DragMoveEvent) {
    setOffsetLeft(e.delta.x);
    setOverId(e.over ? String(e.over.id) : null);
  }
  function onDragEnd(e: DragEndEvent) {
    const active = activeId;
    resetDrag();
    if (!projected || !active || !e.over) return;
    // Soltou no próprio lugar, sem mudar de pai → não faz nada (evita
    // "movimentos fantasma" ao clicar/arrastar de leve).
    const activeItem = flat.find((i) => i.id === active);
    if (e.over.id === active && projected.parentId === (activeItem?.parentId ?? null)) return;

    const overIndex = flat.findIndex((i) => i.id === e.over!.id);
    const { prev, next } = siblingPositions(
      flat,
      projected.parentId,
      active,
      overIndex,
    );
    run(() =>
      moveNode({
        id: active,
        newParentId: projected.parentId,
        prevPosition: prev,
        nextPosition: next,
      }),
    );
  }
  function resetDrag() {
    setActiveId(null);
    setOverId(null);
    setOffsetLeft(0);
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
              onClick={() => {
                const title = prompt("Nome da pasta:");
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
              onClick={() => {
                const title = prompt("Título do artigo:");
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
              title="Publicar tudo"
              className="rounded p-1 text-text-muted hover:bg-surface hover:text-primary"
              onClick={() => {
                if (confirm(`Publicar "${item.node.title}" e TODOS os artigos dentro?`))
                  run(async () => {
                    const r = await publishSubtree(item.id);
                    return r.ok ? { ok: true } : { ok: false, error: r.error };
                  });
              }}
            >
              <CheckCircle2 className="size-3.5" />
            </button>
            <button
              type="button"
              title="Gerar embeddings (pasta toda)"
              className="rounded p-1 text-text-muted hover:bg-surface hover:text-primary"
              onClick={() => {
                if (
                  confirm(
                    `Gerar embeddings de TODOS os artigos dentro de "${item.node.title}" (todos os níveis)?`,
                  )
                )
                  startTransition(async () => {
                    setMessage("Gerando embeddings…");
                    const r = await reindexSubtreeEmbeddings(item.id);
                    setMessage(
                      r.ok
                        ? `Embeddings gerados: ${r.count} artigo(s).`
                        : (r.error ?? "Falha."),
                    );
                    router.refresh();
                  });
              }}
            >
              <Sparkles className="size-3.5" />
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
          onClick={() => {
            if (confirm(`Excluir "${item.node.title}" e tudo dentro?`))
              run(() => deleteNode(item.id));
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
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => { setCreating("folder"); setDraftTitle(""); }}>
            <FolderPlus className="size-4" /> Pasta
          </Button>
          <Button size="sm" variant="secondary" onClick={() => { setCreating("article"); setDraftTitle(""); }}>
            <FilePlus className="size-4" /> Artigo
          </Button>
        </div>
        {creating && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const title = draftTitle.trim();
              if (title) run(() => createNode({ spaceId, parentId: null, type: creating, title }));
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
              className="h-7 min-w-0 flex-1 rounded border border-border bg-surface px-2 text-sm focus:border-primary focus:outline-none"
            />
            <button type="submit" className="shrink-0 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-fg">
              Criar
            </button>
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

      {checkedIds.size > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-primary/40 bg-brand-purple-50 px-2 py-1.5 text-sm dark:bg-brand-purple-950/30">
          <span className="font-medium text-primary">{checkedIds.size} selecionado(s)</span>
          <select
            defaultValue=""
            className="h-7 rounded border border-border bg-surface px-1 text-xs"
            aria-label="Mover para"
            onChange={(e) => {
              const dest = e.target.value;
              e.target.value = "";
              const ids = [...checkedIds];
              run(async () => {
                const r = await moveNodesToParent(ids, dest === "__root__" ? null : dest);
                clearSelection();
                return r;
              });
            }}
          >
            <option value="" disabled>
              Mover para…
            </option>
            <option value="__root__">Raiz</option>
            {folders
              .filter((f) => !checkedIds.has(f.id))
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {"— ".repeat(f.depth)}
                  {f.node.title}
                </option>
              ))}
          </select>
          {selectedArticles.length >= 2 && (
            <button
              type="button"
              className="rounded px-2 py-0.5 text-xs text-primary hover:bg-surface"
              title="Unificar os artigos selecionados em um só, na ordem da árvore"
              onClick={() => {
                if (
                  confirm(
                    `Unificar ${selectedArticles.length} artigos em um só? Os originais vão para a lixeira.`,
                  )
                ) {
                  const ids = selectedArticles;
                  run(async () => {
                    const r = await mergeArticles(ids);
                    clearSelection();
                    if (r.ok && r.id) router.push(`/admin/conteudo/${r.id}`);
                    return r;
                  });
                }
              }}
            >
              Unificar ({selectedArticles.length})
            </button>
          )}
          {spaces.length > 1 && (
            <button
              type="button"
              className="rounded px-2 py-0.5 text-xs text-primary hover:bg-surface"
              title="Copiar ou mover os itens marcados para outra documentação"
              onClick={() => setSendToSpace(true)}
            >
              Outra documentação
            </button>
          )}
          <button
            type="button"
            className="rounded px-2 py-0.5 text-xs text-primary hover:bg-surface"
            title="Gerar embeddings dos itens marcados, incluindo tudo abaixo na hierarquia"
            onClick={() => {
              const ids = [...checkedIds];
              if (
                !confirm(
                  `Gerar embeddings de ${ids.length} item(ns) selecionado(s), incluindo todo o conteúdo abaixo?`,
                )
              )
                return;
              startTransition(async () => {
                setMessage("Gerando embeddings…");
                let total = 0;
                for (const id of ids) {
                  const r = await reindexSubtreeEmbeddings(id);
                  if (r.ok) total += r.count;
                }
                setMessage(`Embeddings gerados: ${total} artigo(s).`);
                clearSelection();
                router.refresh();
              });
            }}
          >
            Gerar embeddings
          </button>
          <button
            type="button"
            className="rounded px-2 py-0.5 text-xs text-brand-pink-700 hover:bg-surface"
            onClick={() => {
              if (confirm(`Excluir ${checkedIds.size} item(ns) e tudo dentro?`)) {
                const ids = [...checkedIds];
                run(async () => {
                  const r = await deleteNodes(ids);
                  clearSelection();
                  return r;
                });
              }
            }}
          >
            Excluir
          </button>
          <button type="button" className="ml-auto text-xs text-text-muted hover:text-text" onClick={clearSelection}>
            Limpar
          </button>
        </div>
      )}

      {message && (
        <p className="mb-2 rounded-md bg-brand-pink-50 px-2 py-1 text-xs text-brand-pink-700 dark:bg-brand-pink-950/40 dark:text-brand-pink-300">
          {message}
        </p>
      )}

      {propsNode && (
        <NodePropertiesDialog
          node={propsNode}
          onClose={() => setPropsNode(null)}
          onDone={(m) => {
            setMessage(m);
            router.refresh();
          }}
        />
      )}

      {sendToSpace && (
        <CopyToSpaceDialog
          nodeIds={[...checkedIds]}
          currentSpaceId={spaceId}
          spaces={spaces}
          onClose={() => setSendToSpace(false)}
          onDone={(m) => {
            setMessage(m);
            clearSelection();
          }}
        />
      )}

      {flat.length === 0 ? (
        <p className="px-2 py-6 text-sm text-text-muted">
          Árvore vazia. Crie uma pasta ou artigo para começar.
        </p>
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
                depth={
                  item.id === activeId && projected
                    ? projected.depth
                    : item.depth
                }
                collapsed={collapsed.has(item.id)}
                hasChildren={hasChildrenMap.get(item.id) ?? false}
                active={item.id === activeId}
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
                    router.push(`/admin/conteudo/${item.id}`, { scroll: false });
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
