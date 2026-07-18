"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import type { SpaceInfo } from "@/lib/content/spaces";
import { createClientSpace } from "@/app/(admin)/admin/(app)/conteudo/space-actions";

/** Seletor de espaço + criação de espaço-cliente. */
export function SpaceSwitcher({
  spaces,
  currentId,
  canCreate,
}: {
  spaces: SpaceInfo[];
  currentId: string;
  canCreate: boolean;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  return (
    <div className="mb-3 flex items-center gap-2">
      <select
        value={currentId}
        onChange={(e) => router.push(`/admin/conteudo?space=${e.target.value}`)}
        className="h-8 flex-1 rounded-md border border-border bg-surface px-2 text-sm"
        aria-label="Espaço"
      >
        {spaces.map((s) => (
          <option key={s.id} value={s.id}>
            {s.type === "global" ? "🌐 " : "👤 "}
            {s.name}
          </option>
        ))}
      </select>
      {canCreate && (
        <button
          type="button"
          title="Novo espaço-cliente"
          disabled={creating}
          className="rounded-md border border-border p-1.5 text-text-muted hover:border-primary hover:text-primary"
          onClick={async () => {
            const name = prompt("Nome do espaço-cliente (ex.: Cliente A):");
            if (!name) return;
            setCreating(true);
            const res = await createClientSpace(name);
            setCreating(false);
            if (res.ok && res.id) router.push(`/admin/conteudo?space=${res.id}`);
            else alert(res.ok ? "" : res.error);
          }}
        >
          <Plus className="size-4" />
        </button>
      )}
    </div>
  );
}
