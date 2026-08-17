"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Trash2, FolderTree, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/ui/toast";
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
  const { confirmar } = useConfirm();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string; count?: number }>, okMsg: (n?: number) => string) {
    startTransition(async () => {
      const r = await fn();
      if (r.ok) toast.success(okMsg(r.count));
      else toast.error(r.error ?? "Falha.");
      router.refresh();
    });
  }

  /**
   * Título, descrição, largura e a ação da página saíram daqui e foram para o
   * `PageShell` da rota. Esta tela montava a própria moldura — `<h1>` com sua
   * classe, seu espaçamento e sua `max-w-3xl` escolhida caso a caso — e era uma
   * de quinze fazendo isso, cada uma com um resultado ligeiramente diferente.
   * Disciplina não sustenta isso; anatomia obrigatória sustenta.
   */
  return (
    <>
      <div className="mb-4 flex items-center justify-end">
        {canEmpty && initialItems.length > 0 && (
          <Button
            variant="secondary"
            disabled={pending}
            onClick={async () => {
              if (
                await confirmar({
                  title: "Esvaziar lixeira",
                  description: "Isso exclui TUDO definitivamente e não pode ser desfeito.",
                  tone: "danger",
                  confirmLabel: "Esvaziar",
                  typeToConfirm: "esvaziar",
                })
              )
                run(emptyTrash, (n) => `Lixeira esvaziada (${n} itens removidos).`);
            }}
          >
            <Trash2 className="size-4" /> Esvaziar lixeira
          </Button>
        )}
      </div>

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
                    onClick={async () => {
                      if (
                        await confirmar({
                          title: "Excluir definitivamente",
                          description: `Excluir "${it.title}" definitivamente? Não pode ser desfeito.`,
                          tone: "danger",
                        })
                      )
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
    </>
  );
}
