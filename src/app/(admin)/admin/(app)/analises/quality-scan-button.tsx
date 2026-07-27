"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { runQualityScan } from "./quality-actions";

/** Dispara a varredura de qualidade de uma documentação (roda no worker). */
export function QualityScanButton({ spaces }: { spaces: { id: string; name: string }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [spaceId, setSpaceId] = useState(spaces[0]?.id ?? "");
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={spaceId}
        onChange={(e) => setSpaceId(e.target.value)}
        aria-label="Documentação"
        className={`${controlClass} h-9 w-auto`}
      >
        {spaces.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <Button
        size="sm"
        variant="secondary"
        disabled={pending || !spaceId}
        onClick={() =>
          startTransition(async () => {
            const r = await runQualityScan(spaceId);
            if (r.ok)
              toast.success("Varredura na fila — o worker processa e o resultado aparece aqui.");
            else toast.error(r.error);
            router.refresh();
          })
        }
      >
        <Gauge className="size-4" /> {pending ? "Enviando…" : "Analisar qualidade"}
      </Button>
    </div>
  );
}
