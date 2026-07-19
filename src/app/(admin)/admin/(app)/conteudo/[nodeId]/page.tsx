import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { listTree, slugPathsOf } from "@/lib/content/tree";
import { getEffectiveTreeAdmin } from "@/lib/content/overlays";
import { env } from "@/lib/env";
import { ContentShell } from "@/components/content/content-shell";
import { Tree } from "@/components/content/tree";
import { ClientTree } from "@/components/content/client-tree";
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

  const supabase = await createClient();
  const [{ data: node }, { data: article }] = await Promise.all([
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
  ]);

  if (!node || node.type !== "article") notFound();

  // A árvore lateral é SEMPRE a do espaço do artigo (não a do espaço padrão),
  // senão a seleção "perde a referência" e clicar abre o nó errado.
  const [{ data: nodeSpace }, slugPaths] = await Promise.all([
    supabase
      .from("spaces")
      .select("id, slug, name, type, visibility")
      .eq("id", node.space_id)
      .single(),
    slugPathsOf(node.space_id),
  ]);

  const aside =
    nodeSpace?.type === "client" ? (
      <ClientTree clientSpaceId={node.space_id} nodes={await getEffectiveTreeAdmin(node.space_id)} />
    ) : (
      <Tree spaceId={node.space_id} nodes={await listTree(node.space_id)} selectedId={nodeId} />
    );
  const path = slugPaths.get(nodeId) ?? [];
  const publicUrl = nodeSpace
    ? `${env.NEXT_PUBLIC_SITE_URL}/docs/${nodeSpace.slug}/${path.join("/")}`
    : undefined;
  const [canRestore, canPublish, canApprove, canReject, canComment] = await Promise.all([
    hasPermission("content.restore", node.space_id),
    hasPermission("content.publish", node.space_id),
    hasPermission("review.approve", node.space_id),
    hasPermission("review.reject", node.space_id),
    hasPermission("review.comment", node.space_id),
  ]);

  return (
    <ContentShell aside={aside}>
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
        canPublish={canPublish}
        canReview={canApprove || canReject}
        canComment={canComment}
      />
    </ContentShell>
  );
}
