import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { getDefaultSpace } from "@/lib/content/tree";
import { listSpaces } from "@/lib/content/spaces";
import { ImportarTabs } from "./importar-tabs";
import type { ImportJobRow } from "./import-manager";
import { listEmbeddingsReport } from "./embeddings-actions";
import { SemPermissao } from "@/components/ui/sem-permissao";

export const metadata: Metadata = { title: "Importar" };

export default async function ImportarPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; space?: string; node?: string }>;
}) {
  const [canImport, canEmbed] = await Promise.all([
    hasPermission("content.import"),
    hasPermission("embeddings.reindex"),
  ]);
  if (!canImport && !canEmbed) {
    return (
      <SemPermissao
        titulo="Importar"
        oQue="importar documentos"
        permissao="content.import"
        papel="Gestor de conteúdo"
      />
    );
  }

  const space = await getDefaultSpace();
  if (!space) {
    return <div className="p-8 text-text-muted">Nenhum espaço encontrado.</div>;
  }

  const supabase = await createClient();
  const jobs = canImport
    ? (
        await supabase
          .from("import_jobs")
          .select("id, original_name, status, progress, error, created_at")
          .eq("space_id", space.id)
          .order("created_at", { ascending: false })
          .limit(50)
      ).data ?? []
    : [];
  const report = canEmbed ? await listEmbeddingsReport() : [];
  const spaces = canEmbed ? (await listSpaces()).map((s) => ({ id: s.id, name: s.name })) : [];
  const embJobs = canEmbed
    ? (
        await supabase
          .from("embedding_jobs")
          .select("id, space_id, scope, status, total, done, progress, error, created_at")
          .in("status", ["queued", "running"])
          .order("created_at", { ascending: false })
      ).data ?? []
    : [];
  const { tab, space: spaceSel, node: nodeSel } = await searchParams;

  return (
    <ImportarTabs
      canImport={canImport}
      canEmbed={canEmbed}
      spaceId={space.id}
      spaces={spaces}
      initialJobs={jobs as ImportJobRow[]}
      report={report}
      embJobs={embJobs}
      initialTab={tab}
      initialSpaceId={spaceSel}
      initialNodeId={nodeSel}
    />
  );
}
