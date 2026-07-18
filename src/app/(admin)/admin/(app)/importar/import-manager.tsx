"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { createImportJob, deleteImportJob } from "./actions";

export type ImportJobRow = {
  id: string;
  original_name: string | null;
  status: string;
  progress: number;
  error: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  queued: "Na fila",
  extracting: "Extraindo",
  inferring: "Inferindo estrutura",
  preview: "Pronto para revisão",
  importing: "Importando",
  done: "Concluído",
  error: "Erro",
};

export function ImportManager({
  spaceId,
  initialJobs,
}: {
  spaceId: string;
  initialJobs: ImportJobRow[];
}) {
  const router = useRouter();
  const supabase = createClient();
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
        <p className="mt-3 rounded-md bg-brand-pink-50 px-3 py-2 text-sm text-brand-pink-700 dark:bg-brand-pink-950/40 dark:text-brand-pink-300">
          {msg}
        </p>
      )}

      <div className="mt-6 space-y-2">
        {jobs.length === 0 && (
          <p className="text-sm text-text-muted">Nenhuma importação ainda.</p>
        )}
        {jobs.map((job) => (
          <div key={job.id} className="rounded-lg border border-border p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-medium">{job.original_name}</div>
                <div className="text-xs text-text-muted">
                  {STATUS_LABEL[job.status] ?? job.status}
                  {job.error ? ` — ${job.error}` : ""}
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
                  className="text-xs text-text-muted hover:text-brand-pink-700"
                  onClick={() => {
                    if (confirm("Remover esta importação?")) deleteImportJob(job.id);
                  }}
                >
                  Remover
                </button>
              </div>
            </div>
            {job.status !== "done" && job.status !== "error" && (
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${job.progress}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
