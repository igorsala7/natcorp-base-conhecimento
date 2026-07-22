"use client";

import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { Block, BlockType } from "@/lib/blocks/schema";
import { newId } from "@/lib/blocks/schema";
import { BLOCKS } from "@/lib/blocks/registry.meta";
import { moveBlock, findBlock } from "@/lib/blocks/tree-ops";
import { BlockList } from "./block-item";
import { SlashMenu } from "./slash-menu";
import { BlockContextMenu } from "./block-context-menu";
import { ActiveRichTextProvider } from "./rich-text/active";
import { useEditorActions } from "./use-editor-actions";
import { useUndoRedo } from "./use-undo-redo";

/**
 * Editor de blocos EMBUTIDO — o motor completo (slash, arrastar, menu de
 * contexto, desfazer) sem o chrome de publicação/autosave/revisão.
 *
 * SEMI-controlado de propósito: o estado dos blocos vive AQUI e sobe por
 * `onChange`; o dono troca de documento remontando com `key` (sincronizar a
 * prop `blocks` de volta brigaria com a regra do RichText de não sobrescrever
 * o DOM com foco). Usado pelo editor inline da prévia e pela prévia do
 * Estúdio IA.
 *
 * Requisitos herdados do motor: `DndContext` precisa de id determinístico e
 * único por instância (`instanceId`); o ⌘Z DEVE ser interceptado com
 * preventDefault (o desfazer nativo do contentEditable dessincroniza DOM e
 * JSON); a calha à esquerda (`pl-10`) abriga as alças em -left-11.
 */
export function EmbeddedBlockEditor({
  instanceId,
  spaceId,
  initialBlocks,
  onChange,
  snippets,
}: {
  instanceId: string;
  spaceId: string;
  initialBlocks: Block[];
  onChange: (blocks: Block[]) => void;
  snippets?: { key: string; title: string }[];
}) {
  const [blocks, setBlocks] = useState<Block[]>(
    initialBlocks.length ? initialBlocks : [{ id: newId(), type: "paragraph", text: [] }],
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

  // Propaga toda mudança ao dono (fora do render, para não disparar setState
  // de outro componente durante o commit). O ref é atualizado DENTRO do efeito
  // (regra do lint: ref não se toca durante o render).
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    onChangeRef.current(blocks);
  }, [blocks]);

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

  function onSlashSnippet(key: string) {
    const alvo = slash;
    setSlash(null);
    if (!alvo) return;
    const nb: Block = { id: newId(), type: "snippet", data: { snippetKey: key } };
    setBlocks((bs) => {
      if (alvo.id === null) return [...bs, nb];
      const i = bs.findIndex((b) => b.id === alvo.id);
      return i < 0 ? [...bs, nb] : [...bs.slice(0, i + 1), nb, ...bs.slice(i + 1)];
    });
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
      <div onKeyDown={onKeyDown}>
        <div
          // `editor-blocks`: na edição cada bloco tem wrapper próprio e as
          // margens não colapsam — sem isto o espaçamento dobra (ver globals).
          className="editor-blocks prose prose-neutral prose-portal max-w-none dark:prose-invert"
          onClick={() => setSelectedId(null)}
        >
          <div className="pl-10">
            <DndContext
              // Id explícito e único por instância — várias podem coexistir na
              // página. Ver `ssr-dnd-ids.test.tsx`.
              id={`dnd-emb-${instanceId}`}
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
          <SlashMenu
            rect={slash.rect}
            onSelect={onSlashSelect}
            onClose={() => setSlash(null)}
            snippets={snippets}
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
          />
        )}
      </div>
    </ActiveRichTextProvider>
  );
}
