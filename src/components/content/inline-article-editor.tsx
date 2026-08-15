"use client";

import { useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import type { Block } from "@/lib/blocks/schema";
import { Button } from "@/components/ui/button";
import { EmbeddedBlockEditor } from "@/components/editor/blocks/embedded-editor";
import { useAutosaveArticle } from "@/components/editor/blocks/use-autosave-article";

/**
 * Editor de UM artigo dentro da leitura contínua da prévia.
 *
 * O MOTOR (slash, arrastar, desfazer, menu de contexto) vive no
 * `EmbeddedBlockEditor` — compartilhado com a prévia do Estúdio IA. Aqui fica
 * só o chrome do caso: autosave em rascunho + selo de estado + Concluir.
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
  const [blocks, setBlocks] = useState<Block[]>(blocosIniciais);

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

  return (
    <div className="rounded-lg border border-primary/40 bg-surface p-4 ring-1 ring-primary/10">
      <div className="mb-3 flex items-center gap-2 border-b border-border pb-2 text-xs">
        <span className="font-medium text-primary">Editando</span>
        <span className="text-text-muted">
          {saveState === "saving" && (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="size-3.5 animate-spin" /> salvando…
            </span>
          )}
          {saveState === "saved" && (
            <span className="inline-flex items-center gap-1">
              <Check className="size-3.5" /> {hasDraft ? "salvo como rascunho" : "salvo"}
            </span>
          )}
          {saveState === "error" && <span className="text-red-600">{erro}</span>}
        </span>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={onFechar}>
          <X className="size-4" /> Concluir
        </Button>
      </div>

      <EmbeddedBlockEditor
        instanceId={nodeId}
        spaceId={spaceId}
        initialBlocks={blocosIniciais}
        onChange={setBlocks}
      />
    </div>
  );
}
