"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown, ChevronRight, Clock, Database, RefreshCw, Search, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Segmented } from "@/components/ui/segmented";

export type RunRow = {
  id: string;
  created_at: string;
  base_code: string;
  tool_key: string;
  agent_key: string | null;
  step_index: number;
  ok: boolean;
  status: number | null;
  cached: boolean;
  files: number;
  duration_ms: number | null;
  error: string | null;
  input: unknown;
  request: unknown;
  output: unknown;
};

function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function pretty(v: unknown): string {
  if (v == null) return "—";
  try {
    return typeof v === "string" ? v : JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

export function RunsManager({ runs }: { runs: RunRow[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<"todas" | "ok" | "erro">("todas");
  const [aberta, setAberta] = useState<string | null>(null);

  const nq = norm(q.trim());
  const visiveis = useMemo(
    () =>
      runs.filter((r) => {
        if (filtro === "ok" && !r.ok) return false;
        if (filtro === "erro" && r.ok) return false;
        if (!nq) return true;
        return norm(`${r.tool_key} ${r.base_code} ${r.agent_key ?? ""}`).includes(nq);
      }),
    [runs, filtro, nq],
  );

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-text">Execuções das ferramentas</h2>
        <Button size="sm" variant="secondary" onClick={() => router.refresh()}>
          <RefreshCw /> Atualizar
        </Button>
      </div>
      <p className="mb-3 text-xs text-text-muted">
        O que cada chamada de ferramenta recebeu, a requisição montada (sem segredos) e o retorno.
        Amostra dos últimos registros.
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filtrar por tool, base ou agente…"
            aria-label="Filtrar execuções"
            className="w-full rounded-lg border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-text outline-none placeholder:text-text-muted focus:border-[var(--color-primary)]"
          />
        </div>
        <Segmented
          value={filtro}
          onChange={setFiltro}
          options={[
            { value: "todas", label: "Todas" },
            { value: "ok", label: "Sucesso" },
            { value: "erro", label: "Erro" },
          ]}
        />
      </div>

      {visiveis.length === 0 ? (
        <EmptyState
          icon={Database}
          title="Nenhuma execução"
          description="Assim que uma ferramenta for chamada (no widget, portal ou no Assistente), o passo a passo aparece aqui."
        />
      ) : (
        <ul className="flex flex-col gap-1.5">
          {visiveis.map((r) => {
            const open = aberta === r.id;
            return (
              <li key={r.id} className="rounded-xl border border-border bg-surface">
                <button
                  type="button"
                  onClick={() => setAberta(open ? null : r.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left"
                  aria-expanded={open}
                >
                  {open ? (
                    <ChevronDown className="size-4 shrink-0 text-text-muted" />
                  ) : (
                    <ChevronRight className="size-4 shrink-0 text-text-muted" />
                  )}
                  {r.ok ? (
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                  ) : (
                    <XCircle className="size-4 shrink-0 text-brand-pink-700" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-mono text-sm font-medium text-text">{r.tool_key}</span>
                      <Badge tone="neutral">{r.base_code}</Badge>
                      {r.status != null && <Badge tone={r.ok ? "info" : "warning"}>HTTP {r.status}</Badge>}
                      {r.cached && <Badge tone="neutral">cache</Badge>}
                      {r.files > 0 && <Badge tone="neutral">{r.files} arquivo(s)</Badge>}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" /> {new Date(r.created_at).toLocaleString("pt-BR")}
                      </span>
                      {r.duration_ms != null && <span>· {r.duration_ms} ms</span>}
                      {r.agent_key && <span>· {r.agent_key}</span>}
                      {r.step_index > 0 && <span>· passo {r.step_index}</span>}
                    </span>
                  </span>
                </button>

                {open && (
                  <div className="border-t border-border px-3 py-3">
                    {r.error && (
                      <p className="mb-3 rounded-lg border border-brand-pink-700/40 bg-brand-pink-700/5 px-3 py-2 text-sm text-brand-pink-700">
                        {r.error}
                      </p>
                    )}
                    <RunSection title="Entrada (args do modelo)" value={r.input} />
                    <RunSection title="Requisição (sanitizada)" value={r.request} />
                    <RunSection title="Saída (amostra)" value={r.output} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function RunSection({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="mb-3 last:mb-0">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">{title}</p>
      <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-surface-2/40 p-2.5 text-xs text-text">
        {pretty(value)}
      </pre>
    </div>
  );
}
