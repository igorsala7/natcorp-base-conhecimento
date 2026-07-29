"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, BookOpen } from "lucide-react";
import { AskAiPanel } from "@/components/portal/ask-ai";

/** Página cheia do assistente: intro de marca + o painel de IA aberto por padrão. */
export function IaView({ spaceSlug, spaceName }: { spaceSlug: string; spaceName: string }) {
  const [open, setOpen] = useState(true);
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-surface px-6 py-16 text-center">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Sparkles className="size-8" />
      </span>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text sm:text-3xl">Assistente — {spaceName}</h1>
        <p className="mx-auto mt-2 max-w-md text-text-muted">
          Pergunte o que quiser sobre a documentação de {spaceName}. As respostas citam as fontes.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:opacity-90"
        >
          <Sparkles className="size-4" /> Abrir assistente
        </button>
        <Link
          href={`/docs/${spaceSlug}`}
          className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-medium text-text transition-colors hover:text-primary"
        >
          <BookOpen className="size-4" /> Ver documentação
        </Link>
      </div>
      <AskAiPanel spaceSlug={spaceSlug} open={open} onClose={() => setOpen(false)} />
    </main>
  );
}
