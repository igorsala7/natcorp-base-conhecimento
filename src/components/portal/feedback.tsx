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
      <p className="mt-12 border-t border-border pt-6 text-sm text-text-muted">
        Obrigado pelo retorno!
      </p>
    );
  }

  return (
    <div className="mt-12 border-t border-border pt-6">
      {state === "idle" ? (
        <div className="flex items-center gap-3">
          <span className="text-sm text-text-muted">Isso foi útil?</span>
          <button
            type="button"
            onClick={yes}
            className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm hover:border-primary hover:text-primary"
          >
            <ThumbsUp className="size-4" /> Sim
          </button>
          <button
            type="button"
            onClick={no}
            className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm hover:border-primary hover:text-primary"
          >
            <ThumbsDown className="size-4" /> Não
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface-2 p-4">
          <p className="text-sm font-medium">Como podemos melhorar esta página?</p>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            placeholder="O que faltou? (opcional)"
            className="mt-2 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={sendComment}
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg"
            >
              Enviar
            </button>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent("portal:open-ai"))}
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 px-3 py-1.5 text-sm font-medium text-primary hover:bg-brand-purple-50 dark:hover:bg-brand-purple-950/40"
            >
              <Sparkles className="size-4" /> Perguntar à IA
            </button>
            {supportUrl && (
              <a
                href={supportUrl}
                className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-primary"
              >
                <LifeBuoy className="size-4" /> Suporte
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
