"use client";

import { useState } from "react";
import { controlClass } from "@/components/ui/input";
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
      <div className="mt-10 rounded-xl border border-border bg-surface p-5 text-center shadow-1">
        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          Obrigado pelo retorno!
        </p>
      </div>
    );
  }

  // Cartão centrado da referência: pergunta + botões Sim/Não, com o hover
  // "semáforo" (verde no sim, rosa no não) antecipando o significado do clique.
  if (state === "idle") {
    return (
      <div className="mt-10 rounded-xl border border-border bg-surface p-5 text-center shadow-1">
        <p className="text-sm font-semibold">Isso foi útil?</p>
        <div className="mt-3 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={yes}
            aria-label="Sim, esta página foi útil"
            title="Sim, foi útil"
            className="flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:border-emerald-900 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-300"
          >
            <ThumbsUp className="size-3.5" /> Sim
          </button>
          <button
            type="button"
            onClick={no}
            aria-label="Não, esta página não foi útil"
            title="Não foi útil"
            className="flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 dark:hover:border-rose-900 dark:hover:bg-rose-950/30 dark:hover:text-rose-300"
          >
            <ThumbsDown className="size-3.5" /> Não
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-10 rounded-xl border border-border bg-surface p-5 shadow-1">
      <p className="text-sm font-semibold">Como podemos melhorar esta página?</p>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        placeholder="O que faltou? (opcional)"
        aria-label="Como podemos melhorar esta página"
        className={`${controlClass} mt-2`}
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
