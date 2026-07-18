"use client";

import { useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { submitFeedback } from "@/app/(portal)/actions";

/** Rodapé "Isso foi útil?" — grava feedback do leitor. */
export function Feedback({ nodeId }: { nodeId: string }) {
  const [sent, setSent] = useState(false);

  async function send(helpful: boolean) {
    setSent(true);
    await submitFeedback(nodeId, helpful);
  }

  if (sent) {
    return (
      <p className="mt-10 border-t border-border pt-6 text-sm text-text-muted">
        Obrigado pelo retorno!
      </p>
    );
  }

  return (
    <div className="mt-10 flex items-center gap-3 border-t border-border pt-6">
      <span className="text-sm text-text-muted">Isso foi útil?</span>
      <button
        type="button"
        onClick={() => send(true)}
        className="flex items-center gap-1 rounded-md border border-border px-3 py-1 text-sm hover:border-primary hover:text-primary"
      >
        <ThumbsUp className="size-4" /> Sim
      </button>
      <button
        type="button"
        onClick={() => send(false)}
        className="flex items-center gap-1 rounded-md border border-border px-3 py-1 text-sm hover:border-primary hover:text-primary"
      >
        <ThumbsDown className="size-4" /> Não
      </button>
    </div>
  );
}
