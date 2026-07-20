"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, FileText, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { EmptyState } from "@/components/ui/empty-state";
import { approveReview, rejectReview, type ReviewItem } from "../conteudo/review-actions";

export function ReviewQueue({
  items,
  canApprove,
  canReject,
}: {
  items: ReviewItem[];
  canApprove: boolean;
  canReject: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function approve(id: string) {
    startTransition(async () => {
      const r = await approveReview(id);
      setMsg(r.ok ? "Aprovado e publicado." : r.error);
      router.refresh();
    });
  }
  function reject(id: string) {
    const c = prompt("Motivo da rejeição (enviado ao autor):");
    if (c === null) return;
    startTransition(async () => {
      const r = await rejectReview(id, c);
      setMsg(r.ok ? "Rejeitado — voltou para rascunho." : r.error);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Revisão</h1>
      <p className="mt-1 text-sm text-text-muted">
        Artigos aguardando aprovação para publicar.
      </p>

      {msg && (
        <p role="status" className="mt-3 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm">
          {msg}
        </p>
      )}

      {items.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={CheckCircle2}
          title="Nada na fila de revisão"
          description="Quando um Editor enviar um artigo para aprovação, ele aparece aqui."
        />
      ) : (
        // Um bloco só com divisórias, em vez de N cartões soltos: a lista lê
        // como uma coisa, não como uma pilha.
        <Surface elevation={1} padding="none" className="mt-4 overflow-hidden">
          <ul className="divide-y divide-border">
            {items.map((it) => (
              <li key={it.id} className="flex items-center gap-3 px-4 py-3">
                <FileText className="size-4 shrink-0 text-text-muted" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{it.title}</p>
                  <p className="text-xs text-text-muted">
                    {it.spaceName} · atualizado em{" "}
                    <time dateTime={new Date(it.updated_at).toISOString()}>
                      {new Date(it.updated_at).toLocaleString("pt-BR")}
                    </time>
                  </p>
                </div>
                <Link
                  href={`/admin/conteudo/${it.id}`}
                  className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-surface-2 hover:text-primary"
                  title="Abrir no editor"
                >
                  <Pencil className="size-4" />
                </Link>
                {canReject && (
                  <Button size="sm" variant="secondary" disabled={pending} onClick={() => reject(it.id)}>
                    <XCircle className="size-4" /> Rejeitar
                  </Button>
                )}
                {canApprove && (
                  <Button size="sm" variant="primary" disabled={pending} onClick={() => approve(it.id)}>
                    <CheckCircle2 className="size-4" /> Aprovar
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Surface>
      )}
    </div>
  );
}
