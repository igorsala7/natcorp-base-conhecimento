"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";

/**
 * Botão de demonstração da Fase 0.5: chama POST /api/demo/publish, que é
 * protegido por `content.publish`. Owner/Admin téc./Gestor → autorizado;
 * Editor/Revisor/Leitor → recusado pelo servidor (403).
 * A publicação real chega na Fase 1.
 */
export function PublishDemo() {
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function tryPublish() {
    setLoading(true);
    setResult(null);
    const res = await fetch("/api/demo/publish", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setResult(
      res.ok
        ? `✓ ${res.status} — ${body.message ?? "autorizado"}`
        : `✗ ${res.status} — ${body.error ?? "recusado"}`,
    );
    setLoading(false);
  }

  return (
    <Surface elevation={1} padding="lg" className="mt-8">
      <h2 className="text-sm font-semibold">Teste de permissão (demo)</h2>
      <p className="mt-1 text-sm text-text-muted">
        Chama o endpoint protegido por <code>content.publish</code>. Serve para
        provar que o servidor recusa quem não pode publicar.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <Button onClick={tryPublish} disabled={loading} variant="accent">
          {loading ? "Chamando…" : "Publicar (demo)"}
        </Button>
        {result && (
          <span
            className={
              result.startsWith("✓")
                ? "text-sm text-primary"
                : "text-sm text-brand-pink-700 dark:text-brand-pink-300"
            }
          >
            {result}
          </span>
        )}
      </div>
    </Surface>
  );
}
