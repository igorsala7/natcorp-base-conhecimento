"use client";

import { useMemo } from "react";
import type { Block } from "@/lib/blocks/schema";
import { RenderBlocks } from "@/lib/blocks/render";
import { previewBlocks, temPreview } from "@/lib/blocks/preview-catalog";

/**
 * Exemplo VISUAL de um tipo de bloco — usado nas perguntas da IA ("qual tipo de
 * bloco/layout?") para o autor escolher VENDO o resultado real. O catálogo é
 * puro ([preview-catalog.ts](src/lib/blocks/preview-catalog.ts)); aqui só
 * renderiza.
 */
const VAZIO = new Map<string, Block[]>();

export function BlockPreview({ typeKey }: { typeKey: string }) {
  const blocks = useMemo(() => previewBlocks(typeKey), [typeKey]);
  if (!blocks) return null;
  return (
    <div className="prose-portal pointer-events-none max-h-40 overflow-hidden rounded-md border border-border bg-surface p-2 text-[0.8125rem] [&_*]:!my-1 [&_h2]:!text-sm">
      <RenderBlocks blocks={blocks} snippets={VAZIO} />
    </div>
  );
}

export { temPreview };
