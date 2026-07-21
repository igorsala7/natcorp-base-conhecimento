"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { Surface } from "@/components/ui/surface";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { createImportJob, deleteImportJob } from "./actions";

export type ImportJobRow = {
  id: string;
  original_name: string | null;
  status: string;
  progress: number;
  error: string | null;
  created_at: string;
};

import { STATUS_LABEL, STATUS_TONE, isTerminal } from "./status";

export function ImportManager({
  spaceId,
  initialJobs,
}: {
  spaceId: string;
  initialJobs: ImportJobRow[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const { confirmar } = useConfirm();
  const [jobs, setJobs] = useState<ImportJobRow[]>(initialJobs);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Realtime: acompanha progresso dos jobs deste espaço.
  useEffect(() => {
    const channel = supabase
      .channel(`import-jobs-${spaceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "import_jobs", filter: `space_id=eq.${spaceId}` },
        (payload) => {
          const row = payload.new as ImportJobRow;
          setJobs((prev) => {
            if (payload.eventType === "DELETE") {
              return prev.filter((j) => j.id !== (payload.old as { id: string }).id);
            }
            const exists = prev.some((j) => j.id === row.id);
            return exists
              ? prev.map((j) => (j.id === row.id ? { ...j, ...row } : j))
              : [row, ...prev];
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [spaceId, supabase]);

  // Rede de segurança: enquanto houver job em andamento, recarrega a lista por
  // polling. Se o Realtime não entregar (canal/RLS), o relatório continua vivo.
  const hasActive = jobs.some((j) => !isTerminal(j.status));
  useEffect(() => {
    if (!hasActive) return;
    let alive = true;
    const timer = setInterval(async () => {
      const { data } = await supabase
        .from("import_jobs")
        .select("id, original_name, status, progress, error, created_at")
        .eq("space_id", spaceId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (alive && data) setJobs(data as ImportJobRow[]);
    }, 3000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [hasActive, spaceId, supabase]);

  async function onFile(file: File) {
    setUploading(true);
    setMsg(null);
    const path = `${spaceId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("imports").upload(path, file);
    if (error) {
      setMsg(`Falha no upload: ${error.message}`);
      setUploading(false);
      return;
    }
    const res = await createImportJob({
      spaceId,
      sourceFile: path,
      originalName: file.name,
      mime: file.type || "application/octet-stream",
      sizeBytes: file.size,
    });
    if (!res.ok) setMsg(res.error);
    setUploading(false);
  }

  return (
    <div className="mt-6">
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-10 text-center hover:border-primary">
        <Upload className="size-6 text-text-muted" />
        <span className="text-sm font-medium">
          {uploading ? "Enviando…" : "Clique para escolher um arquivo"}
        </span>
        <span className="text-xs text-text-muted">PDF, DOCX, HTML, Markdown</span>
        <input
          type="file"
          accept=".pdf,.docx,.html,.htm,.md,.markdown,.txt"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
      </label>

      {msg && (
        <p
          role="alert"
          className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          {msg}
        </p>
      )}

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-text-muted">
        Importações
      </h2>
      <div className="mt-3">
        {jobs.length === 0 ? (
          <EmptyState
            icon={Upload}
            title="Nenhuma importação ainda"
            description="Envie um PDF, DOCX, HTML, Markdown ou ZIP acima. O processamento roda em segundo plano e você acompanha o progresso aqui."
          />
        ) : (
          <Surface elevation={1} padding="none" className="overflow-hidden">
            <ul className="divide-y divide-border">
              {jobs.map((job) => (
                <li key={job.id} className="px-4 py-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{job.original_name}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-text-muted">
                        <Badge tone={STATUS_TONE[job.status] ?? "neutral"}>
                          {STATUS_LABEL[job.status] ?? job.status}
                        </Badge>
                        {job.error && <span className="truncate">{job.error}</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {job.status === "preview" && (
                        <Button size="sm" onClick={() => router.push(`/admin/importar/${job.id}`)}>
                          Revisar
                        </Button>
                      )}
                      {job.status === "done" && (
                        <Link href="/admin/conteudo" className="text-sm text-primary hover:underline">
                          Ver na árvore
                        </Link>
                      )}
                      <button
                        type="button"
                        className="rounded-sm text-xs text-text-muted transition-colors hover:text-red-600 dark:hover:text-red-400"
                        onClick={async () => {
                          if (
                            await confirmar({
                              title: "Remover importação",
                              description: "O relatório e o arquivo enviado desta importação são removidos. O conteúdo já importado para a árvore permanece.",
                              tone: "danger",
                              confirmLabel: "Remover",
                            })
                          )
                            deleteImportJob(job.id);
                        }}
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                  {job.status !== "done" && job.status !== "error" && (
                    <div
                      role="progressbar"
                      aria-valuenow={job.progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Progresso de ${job.original_name}`}
                      className="mt-2.5 h-1 overflow-hidden rounded-full bg-surface-2"
                    >
                      <div
                        className="h-full bg-primary transition-[width] duration-base ease-out motion-reduce:transition-none"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Surface>
        )}
      </div>
    </div>
  );
}
