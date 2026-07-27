"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { customizeNode } from "@/app/(admin)/admin/(app)/conteudo/space-actions";

/**
 * Faixa exibida ao ABRIR um item HERDADO numa documentação de cliente: o
 * conteúdo aparece em SÓ LEITURA e este botão faz o fork ("Customizar") para
 * então editar só naquele cliente, navegando para o item já editável.
 */
export function CustomizeBanner({
  clientSpaceId,
  globalNodeId,
  hidden = false,
}: {
  clientSpaceId: string;
  globalNodeId: string;
  hidden?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 px-4 py-3">
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <Lock className="size-4 shrink-0" />
        <span>
          Conteúdo <strong className="text-text">herdado</strong> da documentação global
          {hidden ? " (oculto neste cliente)" : ""} — somente leitura aqui.
        </span>
      </div>
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await customizeNode(clientSpaceId, globalNodeId);
            if (res.ok && res.id) {
              toast.success("Customizado — agora é editável só neste cliente.");
              router.push(`/admin/conteudo/${res.id}?space=${clientSpaceId}`);
            } else toast.error(res.ok ? "Falha ao customizar." : res.error);
          })
        }
      >
        <Sparkles className="size-4" /> {pending ? "Customizando…" : "Customizar para editar"}
      </Button>
    </div>
  );
}
