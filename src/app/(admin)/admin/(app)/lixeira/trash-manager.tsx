"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Trash2, FolderTree, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { EmptyState } from "@/components/ui/empty-state";
import { restoreTrash, hardDeleteTrash, emptyTrash, type TrashItem } from "./actions";

export function TrashManager({
  initialItems,
  canEmpty,
}: {
  initialItems: TrashItem[];
  canEmpty: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string; count?: number }>, okMsg: (n?: number) => string) {
    startTransition(async () => {
      const r = await fn();
      setMsg(r.ok ? okMsg(r.count) : (r.error ?? "Falha."));
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Lixeira</h1>
          <p className="mt-1 text-sm text-text-muted">
            Itens excluídos. Restaurar traz a subárvore inteira de volta ao lugar de origem.
          </p>
        </div>
        {canEmpty && initialItems.length > 0 && (
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => {
              if (confirm("Esvaziar a lixeira? Isso exclui TUDO definitivamente e não pode ser desfeito."))
                run(emptyTrash, (n) => `Lixeira esvaziada (${n} itens removidos).`);
            }}
          >
            <Trash2 className="size-4" /> Esvaziar lixeira
          </Button>
        )}
      </div>

      {msg && (
        <p role="status" className="mb-3 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm">
          {msg}
        </p>
      )}

      {initialItems.length === 0 ? (
        <EmptyState
          icon={Trash2}
          title="A lixeira está vazia"
          description="Itens excluídos ficam aqui por 30 dias e podem ser restaurados no lugar de origem."
        />
      ) : (
        <Surface elevation={1} padding="none" className="overflow-hidden">
          <ul className="divide-y divide-border">
          {initialItems.map((it) => {
            const Icon = it.type === "folder" ? FolderTree : FileText;
            return (
              <li key={it.id} className="flex items-center gap-3 px-4 py-3">
                <Icon className="size-4 shrink-0 text-text-muted" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{it.title}</p>
                  <p className="text-xs text-text-muted">
                    {it.spaceName} · {it.count > 1 ? `${it.count} itens` : "1 item"} · excluído em{" "}
                    <time dateTime={new Date(it.deleted_at).toISOString()}>
                      {new Date(it.deleted_at).toLocaleString("pt-BR")}
                    </time>
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => run(() => restoreTrash(it.id), (n) => `Restaurado (${n} itens).`)}
                >
                  <RotateCcw className="size-4" /> Restaurar
                </Button>
                {canEmpty && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    title="Excluir definitivamente"
                    onClick={() => {
                      if (confirm(`Excluir "${it.title}" definitivamente? Não pode ser desfeito.`))
                        run(() => hardDeleteTrash(it.id), (n) => `Excluído (${n} itens).`);
                    }}
                  >
                    <Trash2 className="size-4 text-red-600 dark:text-red-400" />
                  </Button>
                )}
              </li>
            );
          })}
          </ul>
        </Surface>
      )}
    </div>
  );
}
