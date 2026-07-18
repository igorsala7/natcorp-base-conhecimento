import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { ImportPreview } from "./import-preview";
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
    .select("id, original_name, status, result_tree")
    .eq("id", jobId)
    .single();
  if (!job) notFound();

  const stored = job.result_tree as
    | { tree: ProposedNode[]; images: string[]; usedAi?: boolean }
    | null;

  if (!stored || job.status !== "preview") {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Revisar importação</h1>
        <p className="mt-2 text-text-muted">
          Este job ainda não está pronto para revisão (status: {job.status}).
        </p>
      </div>
    );
  }

  return (
    <ImportPreview
      jobId={job.id}
      fileName={job.original_name ?? "documento"}
      tree={stored.tree}
      images={stored.images}
      usedAi={stored.usedAi ?? false}
    />
  );
}
