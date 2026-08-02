"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, ScrollText } from "lucide-react";

export type TracePasso = { ms: number; passo: string; info?: Record<string, unknown> };
export type ChatTraceRow = {
  id: string;
  created_at: string;
  conversation_id: string | null;
  base_code: string | null;
  p_usuario: string | null;
  p_portal: string | null;
  p_empresa: string | null;
  p_matricula: string | null;
  p_perfil: string | null;
  pergunta: string | null;
  fonte: string | null;
  desfecho: string | null;
  duracao_ms: number | null;
  passos: TracePasso[];
};

const fmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  timeZone: "America/Sao_Paulo",
});
const dataHora = (iso: string) => fmt.format(new Date(iso)).replace(",", "");

/** Cor do "desfecho" para leitura rápida: verde = resposta; âmbar = pergunta/coleta; vermelho = recusa/erro. */
function corDesfecho(d: string | null): string {
  if (!d) return "bg-surface-2 text-text-muted";
  if (d === "resposta") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200";
  if (d.startsWith("clarify") || d === "coleta") return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200";
  if (d.startsWith("recusa") || d.startsWith("erro") || d.startsWith("aviso")) return "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200";
  return "bg-brand-blue-100 text-brand-blue-700 dark:bg-brand-blue-900/40 dark:text-brand-blue-200";
}

const CHIPS: [keyof ChatTraceRow, string][] = [
  ["base_code", "Base"], ["p_usuario", "Usuário"], ["p_portal", "Painel"],
  ["p_empresa", "Empresa"], ["p_matricula", "Matrícula"], ["p_perfil", "Perfil"],
];

export function LogsList({ rows, limite }: { rows: ChatTraceRow[]; limite: number }) {
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setAbertas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface p-10 text-center">
        <ScrollText className="mx-auto size-6 text-text-muted" />
        <p className="mt-2 text-sm text-text-muted">Nenhum registro de fluxo para este filtro.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 text-sm text-text-muted">
        <span className="font-semibold text-text">{rows.length}</span> turno(s)
        {rows.length >= limite && ` · mostrando os ${limite} mais recentes — refine os filtros para ver anteriores`}
      </p>
      <div className="flex flex-col gap-2">
        {rows.map((r) => {
          const aberta = abertas.has(r.id);
          const chips = CHIPS.filter(([k]) => r[k]).map(([k, label]) => (
            <span key={k} className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] text-text-muted">
              <span className="font-medium">{label}:</span>
              <span className="text-text">{String(r[k])}</span>
            </span>
          ));
          return (
            <div key={r.id} className="overflow-hidden rounded-xl border border-border bg-surface shadow-1">
              <button
                type="button"
                onClick={() => toggle(r.id)}
                className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-surface-2/60"
                aria-expanded={aberta}
              >
                <span className="mt-0.5 text-text-muted">
                  {aberta ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${corDesfecho(r.desfecho)}`}>
                      {r.desfecho ?? "—"}
                    </span>
                    {chips}
                  </span>
                  <span className="mt-1.5 block truncate text-sm text-text">{r.pergunta || "(sem pergunta)"}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
                    <span>{dataHora(r.created_at)}</span>
                    <span>{r.passos?.length ?? 0} passo(s)</span>
                    {r.duracao_ms != null && <span>{r.duracao_ms} ms</span>}
                    {r.fonte && <span>fonte: {r.fonte}</span>}
                  </span>
                </span>
              </button>

              {aberta && (
                <ol className="flex flex-col gap-1 border-t border-border bg-surface-2/40 p-4">
                  {(r.passos ?? []).map((p, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="w-16 shrink-0 text-right font-mono text-xs tabular-nums text-text-muted">+{p.ms}ms</span>
                      <span className="min-w-0 flex-1">
                        <span className="font-medium text-text">{p.passo}</span>
                        {p.info && Object.keys(p.info).length > 0 && (
                          <pre className="mt-0.5 overflow-x-auto whitespace-pre-wrap break-words rounded bg-surface px-2 py-1 text-xs text-text-muted">
                            {JSON.stringify(p.info, null, 0)}
                          </pre>
                        )}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
