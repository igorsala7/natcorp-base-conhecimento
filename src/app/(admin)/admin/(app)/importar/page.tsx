import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { getDefaultSpace } from "@/lib/content/tree";
import { ImportManager, type ImportJobRow } from "./import-manager";

export const metadata: Metadata = { title: "Importar" };

export default async function ImportarPage() {
  const canImport = await hasPermission("content.import");
  if (!canImport) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Importar</h1>
        <p className="mt-2 text-text-muted">
          Você não tem permissão para importar conteúdo.
        </p>
      </div>
    );
  }

  const space = await getDefaultSpace();
  if (!space) {
    return <div className="p-8 text-text-muted">Nenhum espaço encontrado.</div>;
  }

  const supabase = await createClient();
  const { data: jobs } = await supabase
    .from("import_jobs")
    .select("id, original_name, status, progress, error, created_at")
    .eq("space_id", space.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Importar documentos</h1>
      <p className="mt-1 text-sm text-text-muted">
        PDF, DOCX, HTML ou Markdown viram uma árvore de artigos após sua revisão.
      </p>
      <ImportManager
        spaceId={space.id}
        initialJobs={(jobs ?? []) as ImportJobRow[]}
      />
    </div>
  );
}
