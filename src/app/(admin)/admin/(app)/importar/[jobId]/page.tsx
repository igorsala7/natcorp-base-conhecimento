import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { ImportPreview } from "./import-preview";
import { ImportProgress } from "./import-progress";
import { parseLog } from "../status";
import { listSpaces } from "@/lib/content/spaces";
import type { ProposedNode } from "@/lib/importer/structure";

export const metadata: Metadata = { title: "Revisar importação" };

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  if (!(await hasPermission("content.import"))) notFound();

  const supabase = await createClient();
  const { data: job } = await supabase
    .from("import_jobs")
    .select("id, space_id, original_name, status, progress, error, log, result_tree")
    .eq("id", jobId)
    .single();
  if (!job) notFound();

  const stored = job.result_tree as
    | {
        tree: ProposedNode[];
        images: string[];
        usedAi?: boolean;
        destinoNodeId?: string | null;
        destinoSpaceId?: string;
      }
    | null;

  // Para onde ir quando a importação (com melhoria de layout) terminar.
  const doneHref = stored?.destinoNodeId
    ? `/admin/conteudo/${stored.destinoNodeId}`
    : stored?.destinoSpaceId
      ? `/admin/conteudo?space=${stored.destinoSpaceId}`
      : null;

  // Ainda processando (ou falhou): mostra o progresso + relatório ao vivo.
  if (!stored || job.status !== "preview") {
    return (
      <ImportProgress
        jobId={job.id}
        fileName={job.original_name ?? "documento"}
        doneHref={doneHref}
        initial={{
          status: job.status,
          progress: job.progress ?? 0,
          error: job.error,
          log: parseLog(job.log),
        }}
      />
    );
  }

  // Pronto para revisão: documentações possíveis como destino.
  const spaces = await listSpaces();

  return (
    <ImportPreview
      jobId={job.id}
      fileName={job.original_name ?? "documento"}
      tree={stored.tree}
      images={stored.images}
      usedAi={stored.usedAi ?? false}
      spaces={spaces.map((s) => ({ id: s.id, name: s.name, type: s.type }))}
      defaultSpaceId={job.space_id}
    />
  );
}
