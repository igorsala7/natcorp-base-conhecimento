"use client";

import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Check, Loader2, X } from "lucide-react";
import type { Block, BlockType } from "@/lib/blocks/schema";
import { newId } from "@/lib/blocks/schema";
import { BLOCKS } from "@/lib/blocks/registry.meta";
import { moveBlock, findBlock } from "@/lib/blocks/tree-ops";
import { Button } from "@/components/ui/button";
import { BlockList } from "@/components/editor/blocks/block-item";
import { SlashMenu } from "@/components/editor/blocks/slash-menu";
import { BlockContextMenu } from "@/components/editor/blocks/block-context-menu";
import { ActiveRichTextProvider } from "@/components/editor/blocks/rich-text/active";
import { useEditorActions } from "@/components/editor/blocks/use-editor-actions";
import { useUndoRedo } from "@/components/editor/blocks/use-undo-redo";
import { useAutosaveArticle } from "@/components/editor/blocks/use-autosave-article";

/**
 * Editor de UM artigo dentro da leitura contínua da prévia.
 *
 * É o mesmo motor do editor de página — mesmos `useEditorActions`,
 * `useUndoRedo` e `useAutosaveArticle` — sem o cabeçalho, a barra de
 * ferramentas e o painel de propriedades. A intenção aqui é corrigir texto
 * lendo, não montar layout: para isso existe o editor completo.
 *
 * Formatação (negrito, itálico, link…) continua funcionando pelos atalhos de
 * teclado, que o próprio <RichText> trata.
 */
export function InlineArticleEditor({
  nodeId,
  spaceId,
  blocosIniciais,
  hasDraftInicial,
  onDraft,
  onFechar,
}: {
  nodeId: string;
  spaceId: string;
  blocosIniciais: Block[];
  hasDraftInicial: boolean;
  /** Avisa a prévia para atualizar o selo e a contagem de pendências. */
  onDraft: (hasDraft: boolean) => void;
  onFechar: () => void;
}) {
  const [blocks, setBlocks] = useState<Block[]>(
    blocosIniciais.length ? blocosIniciais : [{ id: newId(), type: "paragraph", text: [] }],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [autoFocusId, setAutoFocusId] = useState<string | null>(null);
  const [slash, setSlash] = useState<{ id: string | null; rect: DOMRect } | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ block: Block; x: number; y: number } | null>(null);

  const actions = useEditorActions({ setBlocks, setSelectedId, setAutoFocusId, setSlash });
  const { desfazer, refazer, revisao } = useUndoRedo(blocks, setBlocks, () => {
    setSelectedId(null);
    setSlash(null);
    setCtxMenu(null);
  });

  const { saveState, hasDraft, erro } = useAutosaveArticle(nodeId, blocks, {
    hasDraftInicial,
  });
  // Repassa para a prévia sem efeito: durante o render do pai já vale o novo
  // valor, e um useEffect aqui só adiaria o selo em um quadro.
  const [ultimoDraft, setUltimoDraft] = useState(hasDraftInicial);
  if (hasDraft !== ultimoDraft) {
    setUltimoDraft(hasDraft);
    onDraft(hasDraft);
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function onSlashSelect(type: BlockType) {
    const alvo = slash;
    setSlash(null);
    if (!alvo) return;
    if (alvo.id === null) {
      const nb = BLOCKS[type].defaultData();
      setBlocks((bs) => [...bs, nb]);
      setAutoFocusId(nb.id);
      setSelectedId(nb.id);
      return;
    }
    const b = findBlock(blocks, alvo.id);
    const vazio = b && "text" in b && b.text.length === 0;
    if (vazio) actions.transform(alvo.id, type);
    else actions.insertAfter(alvo.id, type);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    if (e.key.toLowerCase() === "z") {
      // preventDefault é obrigatório: sem ele o desfazer nativo do navegador
      // mexe no contentEditable por baixo e o DOM sai de sincronia com o JSON.
      e.preventDefault();
      if (e.shiftKey) refazer();
      else desfazer();
    }
  }

  return (
    <ActiveRichTextProvider>
      <div
        onKeyDown={onKeyDown}
        className="rounded-lg border border-primary/40 bg-surface p-4 ring-1 ring-primary/10"
      >
        <div className="mb-3 flex items-center gap-2 border-b border-border pb-2 text-xs">
          <span className="font-medium text-primary">Editando</span>
          <span className="text-text-muted">
            {saveState === "saving" && (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="size-3 animate-spin" /> salvando…
              </span>
            )}
            {saveState === "saved" && (
              <span className="inline-flex items-center gap-1">
                <Check className="size-3" /> {hasDraft ? "salvo como rascunho" : "salvo"}
              </span>
            )}
            {saveState === "error" && <span className="text-red-600">{erro}</span>}
          </span>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={onFechar}>
            <X className="size-4" /> Concluir
          </Button>
        </div>

        <div
          className="prose prose-neutral prose-portal max-w-none dark:prose-invert"
          onClick={() => setSelectedId(null)}
        >
          <div className="pl-10">
            <DndContext
              // Id explícito e único por artigo — vários editores podem estar
              // montados na mesma página. Ver `ssr-dnd-ids.test.tsx`.
              id={`dnd-artigo-${nodeId}`}
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(e: DragEndEvent) => {
                const { active, over } = e;
                if (over && active.id !== over.id) {
                  setBlocks((bs) => moveBlock(bs, String(active.id), String(over.id)));
                }
              }}
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
          </div>
        </div>

        {slash && (
          <SlashMenu rect={slash.rect} onSelect={onSlashSelect} onClose={() => setSlash(null)} />
        )}
        {ctxMenu && (
          <BlockContextMenu
            block={ctxMenu.block}
            x={ctxMenu.x}
            y={ctxMenu.y}
            actions={actions}
            onClose={() => setCtxMenu(null)}
            onProperties={() => setSelectedId(ctxMenu.block.id)}
          />
        )}
      </div>
    </ActiveRichTextProvider>
  );
}
