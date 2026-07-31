"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { createApiKey, revokeApiKey } from "./actions";
import { API_SCOPES } from "./scopes";

type KeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  active: boolean;
  last_used_at: string | null;
  created_at: string;
};

const dataBR = (s: string | null) =>
  s ? new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

export function ApiKeysManager({ keys }: { keys: KeyRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<Set<string>>(new Set(["content.view"]));
  const [novoSegredo, setNovoSegredo] = useState<string | null>(null);

  const toggleScope = (s: string) =>
    setScopes((prev) => {
      const n = new Set(prev);
      if (n.has(s)) n.delete(s);
      else n.add(s);
      return n;
    });

  function criar() {
    start(async () => {
      const r = await createApiKey({ name, scopes: [...scopes] });
      if (!r.ok) return toast.error(r.error);
      setNovoSegredo(r.secret ?? null);
      setName("");
      toast.success("Chave criada. Copie o segredo agora — ele não aparece de novo.");
      router.refresh();
    });
  }
  function revogar(id: string) {
    start(async () => {
      const r = await revokeApiKey(id);
      if (!r.ok) return toast.error(r.error);
      toast.success("Chave revogada.");
      router.refresh();
    });
  }

  return (
    <div className="mt-4 flex flex-col gap-5">
      {novoSegredo && (
        <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
          <p className="text-sm font-semibold text-text">Copie o segredo agora — ele não será exibido de novo:</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-lg border border-border bg-surface px-3 py-2 text-xs">{novoSegredo}</code>
            <Button size="sm" variant="secondary" onClick={() => { navigator.clipboard?.writeText(novoSegredo); toast.info("Copiado."); }}>
              Copiar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setNovoSegredo(null)}>Fechar</Button>
          </div>
          <p className="mt-2 text-xs text-text-muted">
            Use em <code>Authorization: Bearer {novoSegredo.slice(0, 12)}…</code> nas rotas <code>/api/manage/v1/…</code>
          </p>
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-text">Nova chave</h2>
        <div className="mt-3 flex flex-col gap-3">
          <input
            className={controlClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome (ex.: Integração ERP, Publicação automática)"
          />
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {API_SCOPES.map((s) => (
              <label key={s} className="inline-flex items-center gap-1.5 text-sm text-text">
                <input type="checkbox" checked={scopes.has(s)} onChange={() => toggleScope(s)} className="size-4 accent-[var(--color-primary)]" />
                <code className="text-xs">{s}</code>
              </label>
            ))}
          </div>
          <div>
            <Button size="sm" onClick={criar} disabled={pending || !name.trim() || scopes.size === 0}>
              Criar chave
            </Button>
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-text">Chaves ({keys.length})</h2>
        {keys.length === 0 ? (
          <p className="text-sm text-text-muted">Nenhuma chave ainda.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {keys.map((k) => (
              <li key={k.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-text">{k.name}</span>
                    {!k.active && <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-xs text-red-600">revogada</span>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-text-muted">
                    <code>{k.key_prefix}</code>
                    <span>escopos: {k.scopes.join(", ") || "—"}</span>
                    <span>último uso: {dataBR(k.last_used_at)}</span>
                  </div>
                </div>
                {k.active && (
                  <Button size="sm" variant="danger" onClick={() => revogar(k.id)} disabled={pending}>
                    Revogar
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
