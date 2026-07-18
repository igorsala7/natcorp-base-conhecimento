"use client";

import { useMemo, useState, useTransition } from "react";
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
import { CheckCircle2, FilePlus, FolderPlus, Link2, Pencil, Sparkles, Trash2 } from "lucide-react";
import type { TreeNode } from "@/lib/content/tree";
import { Button } from "@/components/ui/button";
import {
  changeSlug,
  createNode,
  deleteNode,
  deleteNodes,
  mergeArticles,
  moveNode,
  moveNodesToParent,
  renameNode,
} from "@/app/(admin)/admin/(app)/conteudo/actions";
import { publishSubtree, reindexSubtreeEmbeddings } from "@/app/(admin)/admin/(app)/conteudo/article-actions";
import {
  flatten,
  getProjection,
  siblingPositions,
  type FlatItem,
} from "./tree-utils";
import { TreeItem } from "./tree-item";

const INDENT = 20;

export function Tree({
  spaceId,
  nodes,
  selectedId,
}: {
  spaceId: string;
  nodes: TreeNode[];
  selectedId?: string;
}) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [offsetLeft, setOffsetLeft] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
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
      return next;
    });
  }

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
          title="Renomear"
          className="rounded p-1 text-text-muted hover:bg-surface hover:text-text"
          onClick={() => {
            const title = prompt("Novo nome:", item.node.title);
            if (title) run(() => renameNode(item.id, title));
          }}
        >
          <Pencil className="size-3.5" />
        </button>
        <button
          type="button"
          title="Editar URL (cria redirect 301)"
          className="rounded p-1 text-text-muted hover:bg-surface hover:text-text"
          onClick={() => {
            const slug = prompt("Novo slug (URL):", item.node.slug);
            if (slug) run(() => changeSlug(item.id, slug));
          }}
        >
          <Link2 className="size-3.5" />
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
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            const title = prompt("Nome da pasta:");
            if (title)
              run(() =>
                createNode({ spaceId, parentId: null, type: "folder", title }),
              );
          }}
        >
          <FolderPlus className="size-4" /> Pasta
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            const title = prompt("Título do artigo:");
            if (title)
              run(() =>
                createNode({ spaceId, parentId: null, type: "article", title }),
              );
          }}
        >
          <FilePlus className="size-4" /> Artigo
        </Button>
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

      {flat.length === 0 ? (
        <p className="px-2 py-6 text-sm text-text-muted">
          Árvore vazia. Crie uma pasta ou artigo para começar.
        </p>
      ) : (
        <DndContext
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
                indentationWidth={INDENT}
                onToggle={() => toggle(item.id)}
                onCheck={(e) => onCheck(item.id, e)}
                onSelect={() => {
                  if (item.node.type === "article")
                    router.push(`/admin/conteudo/${item.id}`);
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
