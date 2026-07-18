import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { getDefaultSpace, listTree, slugPathsOf } from "@/lib/content/tree";
import { env } from "@/lib/env";
import { ContentShell } from "@/components/content/content-shell";
import { Tree } from "@/components/content/tree";
import { ArticleEditor } from "@/components/editor/editor";

export const metadata: Metadata = { title: "Editar artigo" };

export default async function EditarArtigoPage({
  params,
}: {
  params: Promise<{ nodeId: string }>;
}) {
  const { nodeId } = await params;

  const canView = await hasPermission("content.view");
  if (!canView) notFound();

  const space = await getDefaultSpace();
  if (!space) notFound();

  const supabase = await createClient();
  const [{ data: node }, { data: article }, tree] = await Promise.all([
    supabase
      .from("nodes")
      .select("id, title, status, type, space_id")
      .eq("id", nodeId)
      .single(),
    supabase
      .from("articles")
      .select("content_json")
      .eq("node_id", nodeId)
      .maybeSingle(),
    listTree(space.id),
  ]);

  if (!node || node.type !== "article") notFound();

  // URL pública do artigo (para copiar/compartilhar) — usa o espaço do nó.
  const [{ data: nodeSpace }, slugPaths] = await Promise.all([
    supabase.from("spaces").select("slug, visibility").eq("id", node.space_id).single(),
    slugPathsOf(node.space_id),
  ]);
  const path = slugPaths.get(nodeId) ?? [];
  const publicUrl = nodeSpace
    ? `${env.NEXT_PUBLIC_SITE_URL}/docs/${nodeSpace.slug}/${path.join("/")}`
    : undefined;
  const canRestore = await hasPermission("content.restore", node.space_id);

  return (
    <ContentShell
      aside={<Tree spaceId={space.id} nodes={tree} selectedId={nodeId} />}
    >
      <ArticleEditor
        nodeId={nodeId}
        spaceId={node.space_id}
        title={node.title}
        initialContent={
          (article?.content_json as object) ?? { type: "doc", content: [] }
        }
        initialStatus={node.status as "draft" | "review" | "published"}
        publicUrl={publicUrl}
        spacePublic={nodeSpace?.visibility === "public"}
        canRestore={canRestore}
      />
    </ContentShell>
  );
}
