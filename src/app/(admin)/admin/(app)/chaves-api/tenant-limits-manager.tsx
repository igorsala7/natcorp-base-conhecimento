"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { saveTenantLimit, deleteTenantLimit } from "./tenant-limits-actions";

type Row = { tenant: string; max_concurrency: number | null; daily_token_cap: number | null; updated_at: string };

export function TenantLimitsManager({ limits, bases }: { limits: Row[]; bases: string[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [tenant, setTenant] = useState("");
  const [conc, setConc] = useState("");
  const [cap, setCap] = useState("");

  const num = (s: string): number | null => {
    const t = s.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? Math.floor(n) : null;
  };

  function salvar() {
    start(async () => {
      const r = await saveTenantLimit({ tenant: tenant.trim(), max_concurrency: num(conc), daily_token_cap: num(cap) });
      if (!r.ok) return toast.error(r.error);
      toast.success("Limite salvo.");
      setTenant("");
      setConc("");
      setCap("");
      router.refresh();
    });
  }
  function remover(t: string) {
    start(async () => {
      const r = await deleteTenantLimit(t);
      if (!r.ok) return toast.error(r.error);
      toast.success("Limite removido.");
      router.refresh();
    });
  }

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold tracking-tight text-text">Limites por base</h2>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-text-muted">
        Ajuste a <b>concorrência de IA</b> (chamadas simultâneas) e a <b>cota diária de tokens</b> por base/cliente. Em
        branco = usa o default do ambiente. A base é o <code>p_base</code> (ex.: <code>natcorp</code>) ou{" "}
        <code>sp:&lt;space_id&gt;</code> para documentações sem base de integração.
      </p>

      <div className="mt-4 rounded-xl border border-border bg-surface p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_9rem_9rem_auto]">
          <input className={controlClass} list="bases-dl" placeholder="base (p_base ou sp:<id>)" value={tenant} onChange={(e) => setTenant(e.target.value)} />
          <input className={controlClass} type="number" min={1} placeholder="concorrência" value={conc} onChange={(e) => setConc(e.target.value)} />
          <input className={controlClass} type="number" min={0} placeholder="tokens/dia" value={cap} onChange={(e) => setCap(e.target.value)} />
          <Button size="sm" onClick={salvar} disabled={pending || !tenant.trim()}>Salvar</Button>
        </div>
        <datalist id="bases-dl">
          {bases.map((b) => (
            <option key={b} value={b} />
          ))}
        </datalist>
      </div>

      <div className="mt-3">
        {limits.length === 0 ? (
          <p className="text-sm text-text-muted">Nenhum override — todas as bases usam os defaults do ambiente.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {limits.map((l) => (
              <li key={l.tenant} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-border bg-surface p-3 text-sm">
                <code className="min-w-0 flex-1 truncate text-text">{l.tenant}</code>
                <span className="text-text-muted">
                  concorrência: <b className="text-text">{l.max_concurrency ?? "default"}</b>
                </span>
                <span className="text-text-muted">
                  tokens/dia: <b className="text-text">{l.daily_token_cap != null ? l.daily_token_cap.toLocaleString("pt-BR") : "sem cota"}</b>
                </span>
                <Button size="sm" variant="danger" onClick={() => remover(l.tenant)} disabled={pending}>
                  Remover
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
