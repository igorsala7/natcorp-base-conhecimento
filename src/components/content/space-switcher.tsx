"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Plus, Settings } from "lucide-react";
import type { SpaceInfo } from "@/lib/content/spaces";
import { NewSpaceDialog } from "./new-space-dialog";
import { controlClass } from "@/components/ui/input";

/** Seletor de espaço + atalho de configurações + criação de espaço-cliente. */
export function SpaceSwitcher({
  spaces,
  currentId,
  canCreate,
  canManage = true,
  switchBasePath,
}: {
  spaces: SpaceInfo[];
  currentId: string;
  canCreate: boolean;
  /** Mostra o atalho de configurações do espaço. */
  canManage?: boolean;
  /**
   * Rota de escape ao trocar de documentação.
   *
   * O padrão é FICAR na tela atual, só trocando o `?space=` — trocar de
   * documentação não deveria tirar ninguém do lugar onde está trabalhando.
   * Telas presas a um item do espaço antigo (o editor de um artigo) informam
   * aqui para onde escapar; recebe `?space=<novo>` no fim.
   *
   * É uma STRING e não uma função de propósito: estas telas são Server
   * Components, e função não atravessa a fronteira para um componente cliente.
   */
  switchBasePath?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [creating, setCreating] = useState(false);

  function irPara(spaceId: string) {
    if (switchBasePath) return router.push(`${switchBasePath}?space=${spaceId}`);
    // Preserva os demais parâmetros (`from`, `edit`…): perdê-los quebraria o
    // "voltar" e desligaria modos já ativos na tela.
    const params = new URLSearchParams(searchParams.toString());
    params.set("space", spaceId);
    router.push(`${pathname}?${params.toString()}`);
  }

  // Volta para exatamente esta tela ao sair das configurações.
  const settingsHref = `/admin/configuracoes?space=${currentId}&from=${encodeURIComponent(pathname)}`;

  return (
    <div className="mb-3 flex items-center gap-2">
      <select
        value={currentId}
        onChange={(e) => irPara(e.target.value)}
        className={`${controlClass} h-8 flex-1 px-2`}
        aria-label="Espaço"
      >
        {spaces.map((s) => (
          <option key={s.id} value={s.id}>
            {s.type === "global" ? "🌐 " : "👤 "}
            {s.name}
          </option>
        ))}
      </select>
      {canManage && (
        <Link
          href={settingsHref}
          title="Configurações desta documentação"
          aria-label="Configurações desta documentação"
          className="rounded-md border border-border p-1.5 text-text-muted hover:border-primary hover:text-primary"
        >
          <Settings className="size-4" />
        </Link>
      )}
      {canCreate && (
        <button
          type="button"
          title="Nova documentação"
          aria-label="Nova documentação"
          className="rounded-md border border-border p-1.5 text-text-muted hover:border-primary hover:text-primary"
          onClick={() => setCreating(true)}
        >
          <Plus className="size-4" />
        </button>
      )}

      {creating && <NewSpaceDialog spaces={spaces} onClose={() => setCreating(false)} />}
    </div>
  );
}
