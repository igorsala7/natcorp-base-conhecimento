import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { listTree, slugPathsOf } from "@/lib/content/tree";
import { listSpaces } from "@/lib/content/spaces";
import { SpaceSwitcher } from "@/components/content/space-switcher";
import { getEffectiveTreeAdmin } from "@/lib/content/overlays";
import { env } from "@/lib/env";
import { ContentShell } from "@/components/content/content-shell";
import { Tree } from "@/components/content/tree";
import { ClientTree } from "@/components/content/client-tree";
import { BlockEditor } from "@/components/editor/blocks/block-editor";

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
  const [{ data: node }, { data: article }, { data: draft }] = await Promise.all([
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
    supabase
      .from("article_drafts")
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

  const [spaces, canCreateSpace, canManageSpace] = await Promise.all([
    listSpaces(),
    hasPermission("space.create"),
    hasPermission("space.manage", node.space_id),
  ]);

  const tree =
    nodeSpace?.type === "client" ? (
      <ClientTree clientSpaceId={node.space_id} nodes={await getEffectiveTreeAdmin(node.space_id)} />
    ) : (
      <Tree spaceId={node.space_id} nodes={await listTree(node.space_id)} selectedId={nodeId} spaces={spaces} />
    );

  const aside = (
    <>
      <SpaceSwitcher
        spaces={spaces}
        currentId={node.space_id}
        canCreate={canCreateSpace}
        canManage={canManageSpace}
        // Única tela que NÃO pode permanecer: o artigo aberto pertence à
        // documentação antiga. Escapa para a árvore da documentação escolhida.
        switchBasePath="/admin/conteudo"
      />
      {tree}
    </>
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
      <BlockEditor
        nodeId={nodeId}
        spaceId={node.space_id}
        title={node.title}
        initialContent={draft?.content_json ?? article?.content_json ?? null}
        publishedContent={article?.content_json ?? null}
        initialHasDraft={draft != null}
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
