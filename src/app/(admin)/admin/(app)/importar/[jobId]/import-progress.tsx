"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { STATUS_LABEL, isTerminal, parseLog, type ImportLogLine } from "../status";

type State = { status: string; progress: number; error: string | null; log: ImportLogLine[] };

/**
 * Acompanha um job em andamento e mostra o RELATÓRIO (o `log` que o worker
 * grava). Usa Realtime e, como rede de segurança, também faz polling — se o
 * Realtime não entregar (canal/RLS), a tela continua atualizando sozinha.
 * Ao ficar pronto (`preview`), dá refresh para a página server renderizar a
 * revisão; ao CONCLUIR (`done`), navega direto para o diretório que recebeu o
 * conteúdo (`doneHref`) — 100% não pode terminar numa tela parada.
 */
export function ImportProgress({
  jobId,
  fileName,
  initial,
  doneHref,
}: {
  jobId: string;
  fileName: string;
  initial: State;
  doneHref?: string | null;
}) {
  const router = useRouter();
  const [job, setJob] = useState<State>(initial);
  const doneRef = useRef(false);

  useEffect(() => {
    if (isTerminal(initial.status)) return;
    const supabase = createClient();
    let alive = true;

    const pull = async () => {
      const { data } = await supabase
        .from("import_jobs")
        .select("status, progress, error, log")
        .eq("id", jobId)
        .maybeSingle();
      if (!alive || !data) return;
      setJob({
        status: data.status,
        progress: data.progress ?? 0,
        error: data.error,
        log: parseLog(data.log),
      });
      // Chegou ao fim: concluído vai para o conteúdo importado; os demais
      // recarregam a página (vai mostrar a revisão ou o erro).
      if (isTerminal(data.status) && !doneRef.current) {
        doneRef.current = true;
        if (data.status === "done" && doneHref) router.push(doneHref);
        else router.refresh();
      }
    };

    const channel = supabase
      .channel(`import-job-${jobId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "import_jobs", filter: `id=eq.${jobId}` },
        () => void pull(),
      )
      .subscribe();

    const timer = setInterval(() => void pull(), 2500);
    void pull();

    return () => {
      alive = false;
      clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [jobId, initial.status, doneHref, router]);

  const erro = job.status === "error";
  const pronto = job.status === "done";

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/admin/importar"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-primary"
      >
        <ArrowLeft className="size-4" /> Importações
      </Link>

      <h1 className="text-2xl font-semibold tracking-tight">Importando “{fileName}”</h1>

      <div className="mt-4 rounded-lg border border-border p-4">
        <div className="flex items-center gap-2 text-sm">
          {erro ? (
            <AlertTriangle className="size-4 text-brand-pink-700" />
          ) : pronto ? (
            <CheckCircle2 className="size-4 text-primary" />
          ) : (
            <Loader2 className="size-4 animate-spin text-primary" />
          )}
          <span className="font-medium">{STATUS_LABEL[job.status] ?? job.status}</span>
          <span className="ml-auto tabular-nums text-text-muted">{job.progress}%</span>
        </div>

        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className={`h-full transition-all duration-300 ${erro ? "bg-red-600 dark:bg-red-500" : "bg-primary"}`}
            style={{ width: `${Math.min(100, Math.max(0, job.progress))}%` }}
          />
        </div>

        {erro && job.error && (
          <p className="mt-3 rounded-md bg-brand-pink-50 px-3 py-2 text-sm text-brand-pink-700 dark:bg-brand-pink-950/40 dark:text-brand-pink-300">
            {job.error}
          </p>
        )}

        {/* Relatório do worker */}
        {job.log.length > 0 && (
          <ol className="mt-4 space-y-1.5 border-t border-border pt-3">
            {job.log.map((l, i) => (
              <li key={i} className="flex gap-2 text-xs">
                <span className="shrink-0 tabular-nums text-text-muted">
                  {l.at ? new Date(l.at).toLocaleTimeString("pt-BR") : "—"}
                </span>
                <span>{l.msg}</span>
              </li>
            ))}
          </ol>
        )}

        {/* Revisita de um job já concluído: sem redirecionar ninguém à força,
            mas o caminho para o resultado fica a um clique. */}
        {pronto && doneHref && (
          <Link
            href={doneHref}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-fg shadow-1 transition-colors hover:bg-primary-hover"
          >
            Abrir o conteúdo importado <ArrowRight className="size-4" />
          </Link>
        )}

        {!erro && !pronto && (
          <p className="mt-3 text-xs text-text-muted">
            Esta tela atualiza sozinha. O processamento roda no worker
            (<code>npm run worker</code>) — se nada avançar, verifique se ele está no ar.
          </p>
        )}
      </div>
    </div>
  );
}
