"use client";

import { useState } from "react";
import { ThumbsDown, ThumbsUp, Sparkles, LifeBuoy } from "lucide-react";
import { submitFeedback } from "@/app/(portal)/actions";

/** Rodapé "Isso foi útil?" — feedback + escalonamento quando negativo. */
export function Feedback({ nodeId, supportUrl }: { nodeId: string; supportUrl?: string }) {
  const [state, setState] = useState<"idle" | "negative" | "done">("idle");
  const [comment, setComment] = useState("");

  async function yes() {
    setState("done");
    await submitFeedback(nodeId, true);
  }
  function no() {
    setState("negative");
    // registra o "não" de imediato; o comentário é opcional e vem depois.
    void submitFeedback(nodeId, false);
  }
  async function sendComment() {
    await submitFeedback(nodeId, false, comment);
    setState("done");
  }

  if (state === "done") {
    return (
      <p className="mt-4 text-right text-xs text-text-muted/70">Obrigado pelo retorno!</p>
    );
  }

  // Discreto de propósito: na leitura contínua isto se repete a cada artigo,
  // então é só uma linha leve no rodapé da seção — sem borda, sem caixa.
  if (state === "idle") {
    return (
      <div className="mt-4 flex items-center justify-end gap-1 text-xs text-text-muted/70">
        <span>Isso foi útil?</span>
        <button
          type="button"
          onClick={yes}
          aria-label="Sim, esta página foi útil"
          title="Sim, foi útil"
          className="flex size-7 items-center justify-center rounded-md transition-colors hover:bg-surface-2 hover:text-primary"
        >
          <ThumbsUp className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={no}
          aria-label="Não, esta página não foi útil"
          title="Não foi útil"
          className="flex size-7 items-center justify-center rounded-md transition-colors hover:bg-surface-2 hover:text-primary"
        >
          <ThumbsDown className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-border p-3">
      <p className="text-xs font-medium text-text-muted">Como podemos melhorar esta página?</p>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        placeholder="O que faltou? (opcional)"
        className="mt-2 w-full rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <button
          type="button"
          onClick={sendComment}
          className="rounded-md bg-primary px-2.5 py-1 font-medium text-primary-fg"
        >
          Enviar
        </button>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("portal:open-ai"))}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium text-primary hover:bg-brand-purple-50 dark:hover:bg-brand-purple-950/40"
        >
          <Sparkles className="size-3.5" /> Perguntar à IA
        </button>
        {supportUrl && (
          <a href={supportUrl} className="inline-flex items-center gap-1 text-text-muted hover:text-primary">
            <LifeBuoy className="size-3.5" /> Suporte
          </a>
        )}
      </div>
    </div>
  );
}
