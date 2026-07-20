"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Block, BlockDoc } from "@/lib/blocks/schema";
import { saveArticle } from "@/app/(admin)/admin/(app)/conteudo/article-actions";

export type SaveState = "idle" | "saving" | "saved" | "error";

const DEBOUNCE_MS = 800;

/**
 * Autosave do artigo com debounce.
 *
 * Quem decide se a gravação vira rascunho ou conteúdo oficial é a
 * `saveArticle` no servidor: artigo publicado → `article_drafts` (a página
 * pública não muda); rascunho/revisão → direto em `content_json`. Por isso o
 * `hasDraft` vem da resposta e não é inferido aqui.
 *
 * `skipSave` existe para reverts internos (descartar rascunho, aplicar
 * histórico): sem ele, desfazer dispararia uma gravação do estado desfeito.
 */
export function useAutosaveArticle(
  nodeId: string,
  blocks: Block[],
  { hasDraftInicial = false }: { hasDraftInicial?: boolean } = {},
) {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [hasDraft, setHasDraft] = useState(hasDraftInicial);
  const [erro, setErro] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const montado = useRef(false);
  const pular = useRef(false);

  /** Marca a PRÓXIMA mudança de blocos como interna (não salvar). */
  const pularProximo = useCallback(() => {
    pular.current = true;
  }, []);

  useEffect(() => {
    if (!montado.current) {
      montado.current = true;
      return;
    }
    if (pular.current) {
      pular.current = false;
      return;
    }
    setSaveState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const res = await saveArticle(nodeId, { version: 2, blocks } satisfies BlockDoc);
      if (res.ok) {
        setSaveState("saved");
        setHasDraft(res.hasDraft);
        setErro(null);
      } else {
        setSaveState("error");
        setErro(res.error);
      }
    }, DEBOUNCE_MS);
  }, [blocks, nodeId]);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  /** Salva imediatamente, sem debounce — usar antes de publicar. */
  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    const res = await saveArticle(nodeId, { version: 2, blocks } satisfies BlockDoc);
    if (res.ok) setHasDraft(res.hasDraft);
    return res;
  }, [nodeId, blocks]);

  return { saveState, setSaveState, hasDraft, setHasDraft, erro, setErro, flush, pularProximo };
}
