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
import { FilePlus, FolderPlus, Pencil, Trash2 } from "lucide-react";
import type { TreeNode } from "@/lib/content/tree";
import { Button } from "@/components/ui/button";
import {
  createNode,
  deleteNode,
  moveNode,
  renameNode,
} from "@/app/(admin)/admin/(app)/conteudo/actions";
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
                indentationWidth={INDENT}
                onToggle={() => toggle(item.id)}
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
