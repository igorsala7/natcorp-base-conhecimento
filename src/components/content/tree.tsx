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
import { CheckCircle2, FilePlus, FolderPlus, Pencil, Sparkles, Trash2, Wand2 } from "lucide-react";
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
import { publishSubtree } from "@/app/(admin)/admin/(app)/conteudo/article-actions";
import {
  flatten,
  getProjection,
  siblingPositions,
  type FlatItem,
} from "./tree-utils";
import { TreeItem } from "./tree-item";
import { CopyToSpaceDialog } from "./copy-to-space-dialog";
import { BUILTIN_TEMPLATES } from "@/lib/blocks/templates";
import {
  getTemplateBlocks,
  listSavedTemplates,
  type TemplateOption,
} from "@/app/(admin)/admin/(app)/conteudo/template-actions";
import { saveArticle } from "@/app/(admin)/admin/(app)/conteudo/article-actions";
import type { SpaceInfo } from "@/lib/content/spaces";

// Um degrau curto por nível (padrão Microsoft Learn): em árvores fundas a
// indentação larga é quem come a largura do título.
const INDENT = 14;

/** O nó (ou algum descendente) é o `id`? Decide se a exclusão fecha o editor. */
function subtreeTemId(n: TreeNode, id: string): boolean {
  return n.id === id || n.children.some((c) => subtreeTemId(c, id));
}

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
  const { confirmar, pedirTexto } = useConfirm();
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
  const [templateSel, setTemplateSel] = useState("none");
  const [salvos, setSalvos] = useState<TemplateOption[]>([]);
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
              onClick={() =>
                router.push(`/admin/importar?tab=embeddings&space=${spaceId}&node=${item.id}`)
              }
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
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => { setCreating("folder"); setDraftTitle(""); }}>
            <FolderPlus className="size-4" /> Pasta
          </Button>
          <Button size="sm" variant="secondary" onClick={() => { setCreating("article"); setDraftTitle(""); setTemplateSel("none"); void listSavedTemplates(spaceId).then(setSalvos); }}>
            <FilePlus className="size-4" /> Artigo
          </Button>
          <Button
            size="sm"
            variant="secondary"
            title="Criar com IA: conversa com um editor que monta artigos e estrutura (Estúdio)"
            onClick={() => router.push(`/admin/estudio?space=${spaceId}&nova=1`)}
          >
            <Wand2 className="size-4" /> Criar com IA
          </Button>
        </div>
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
                    router.push(`/admin/conteudo/${r.id}`);
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
              <select
                value={templateSel}
                onChange={(e) => setTemplateSel(e.target.value)}
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
              </select>
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

      {checkedIds.size > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-primary/40 bg-brand-purple-50 px-2 py-1.5 text-sm dark:bg-brand-purple-950/30">
          <span className="font-medium text-primary">{checkedIds.size} selecionado(s)</span>
          <select
            defaultValue=""
            className={cn(controlClass, "h-7 w-auto px-1 py-1 text-xs")}
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
                    if (r.ok && r.id) router.push(`/admin/conteudo/${r.id}`);
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
            onClick={() => router.push(`/admin/importar?tab=embeddings&space=${spaceId}`)}
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

      {message && (
        <p
          role="alert"
          // A mesma faixa carrega sucesso ("Embeddings gerados…") e erro —
          // o tom segue o conteúdo, não é sempre vermelho.
          className={
            /falha|erro|sem permiss|inválid|não é possível/i.test(message)
              ? "mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
              : "mb-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text-muted"
          }
        >
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
