import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { listTree, slugPathsOf, type TreeNode } from "@/lib/content/tree";
import { listSpaces } from "@/lib/content/spaces";
import { SpaceSwitcher } from "@/components/content/space-switcher";
import { getEffectiveTreeAdmin } from "@/lib/content/overlays";
import { env } from "@/lib/env";
import { ContentShell } from "@/components/content/content-shell";
import { Tree } from "@/components/content/tree";
import { ClientTree } from "@/components/content/client-tree";
import { FolderPanel, type FolderStats } from "@/components/content/folder-panel";
import { BlockEditor } from "@/components/editor/blocks/block-editor";

export const metadata: Metadata = { title: "Editar conteúdo" };

/** Contagens da subárvore de uma pasta (a própria pasta fora da conta). */
function statsDaPasta(tree: TreeNode[], folderId: string): FolderStats {
  const stats: FolderStats = { publicados: 0, rascunhos: 0, emRevisao: 0, pastas: 0 };
  const acha = (list: TreeNode[]): TreeNode | null => {
    for (const n of list) {
      if (n.id === folderId) return n;
      const f = acha(n.children);
      if (f) return f;
    }
    return null;
  };
  const conta = (list: TreeNode[]) => {
    for (const n of list) {
      if (n.type === "article") {
        if (n.status === "published") stats.publicados += 1;
        else if (n.status === "review") stats.emRevisao += 1;
        else stats.rascunhos += 1;
      } else if (n.type === "folder") {
        stats.pastas += 1;
      }
      conta(n.children);
    }
  };
  const alvo = acha(tree);
  if (alvo) conta(alvo.children);
  return stats;
}

export default async function EditarConteudoPage({
  params,
}: {
  params: Promise<{ nodeId: string }>;
}) {
  const { nodeId } = await params;

  const canView = await hasPermission("content.view");
  if (!canView) notFound();

  const supabase = await createClient();
  const { data: node } = await supabase
    .from("nodes")
    .select("id, title, slug, icon, description, parent_id, status, type, space_id")
    .eq("id", nodeId)
    .single();

  if (!node) notFound();
  // Link e divisória não têm tela — só existem na árvore.
  if (node.type !== "article" && node.type !== "folder") redirect("/admin/conteudo");

  // A árvore lateral é SEMPRE a do espaço do nó (não a do espaço padrão),
  // senão a seleção "perde a referência" e clicar abre o nó errado.
  const [{ data: nodeSpace }, slugPaths, ownTree] = await Promise.all([
    supabase
      .from("spaces")
      .select("id, slug, name, type, visibility")
      .eq("id", node.space_id)
      .single(),
    slugPathsOf(node.space_id),
    listTree(node.space_id),
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
      <Tree spaceId={node.space_id} nodes={ownTree} selectedId={nodeId} spaces={spaces} />
    );

  const aside = (
    <>
      <SpaceSwitcher
        spaces={spaces}
        currentId={node.space_id}
        canCreate={canCreateSpace}
        canManage={canManageSpace}
        // Única tela que NÃO pode permanecer: o nó aberto pertence à
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

  // ── Pasta: tela própria (ícone/descrição do card, resumo e ações) ────────
  if (node.type === "folder") {
    const [canEdit, canPublish] = await Promise.all([
      hasPermission("content.edit", node.space_id),
      hasPermission("content.publish", node.space_id),
    ]);
    return (
      <ContentShell aside={aside}>
        <FolderPanel
          node={{
            id: node.id,
            title: node.title,
            slug: node.slug,
            icon: node.icon,
            description: node.description,
          }}
          stats={statsDaPasta(ownTree, node.id)}
          isRoot={node.parent_id === null}
          publicUrl={
            node.status === "published" && nodeSpace?.visibility === "public"
              ? publicUrl
              : undefined
          }
          spaceId={node.space_id}
          canEdit={canEdit}
          canPublish={canPublish}
        />
      </ContentShell>
    );
  }

  // ── Artigo: editor de blocos ─────────────────────────────────────────────
  const [{ data: article }, { data: draft }] = await Promise.all([
    supabase.from("articles").select("content_json").eq("node_id", nodeId).maybeSingle(),
    supabase.from("article_drafts").select("content_json").eq("node_id", nodeId).maybeSingle(),
  ]);

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
