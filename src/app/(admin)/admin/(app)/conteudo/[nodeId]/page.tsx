import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { getDefaultSpace, listTree } from "@/lib/content/tree";
import { ContentShell } from "@/components/content/content-shell";
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

  return (
    <ContentShell
      spaceId={space.id}
      spaceName={space.name}
      tree={tree}
      selectedId={nodeId}
    >
      <ArticleEditor
        nodeId={nodeId}
        spaceId={node.space_id}
        title={node.title}
        initialContent={
          (article?.content_json as object) ?? { type: "doc", content: [] }
        }
        initialStatus={node.status as "draft" | "review" | "published"}
      />
    </ContentShell>
  );
}
