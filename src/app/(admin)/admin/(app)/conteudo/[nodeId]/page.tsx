import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { listTree, slugPathsOf, embeddedNodeIds, ontologyNodeIds, pendingDraftNodeIds, type TreeNode } from "@/lib/content/tree";
import { listSpaces } from "@/lib/content/spaces";
import { SpaceSwitcher } from "@/components/content/space-switcher";
import { getEffectiveTreeAdmin } from "@/lib/content/overlays";
import { env } from "@/lib/env";
import { ContentShell } from "@/components/content/content-shell";
import { Tree } from "@/components/content/tree";
import { ClientTree } from "@/components/content/client-tree";
import { FolderPanel, type FolderStats } from "@/components/content/folder-panel";
import { BlockEditor } from "@/components/editor/blocks/block-editor";
import { CustomizeBanner } from "@/components/content/customize-banner";
import { RenderBlocks } from "@/lib/blocks/render";
import { normalizeDoc } from "@/lib/blocks/convert";
import { resolveTheme } from "@/lib/portal/theme";

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
  searchParams,
}: {
  params: Promise<{ nodeId: string }>;
  searchParams: Promise<{ space?: string }>;
}) {
  const { nodeId } = await params;
  const { space: spaceParam } = await searchParams;

  const canView = await hasPermission("content.view");
  if (!canView) notFound();

  const supabase = await createClient();
  const { data: node } = await supabase
    .from("nodes")
    .select("id, title, slug, icon, description, parent_id, status, type, space_id")
    .eq("id", nodeId)
    // Nó na lixeira não tem tela de edição: sem este filtro, apagar o nó
    // aberto deixava o editor exibindo o conteúdo excluído.
    .is("deleted_at", null)
    .single();

  // Excluído ou inexistente → volta para a árvore (um 404 no admin só
  // confunde: o caminho normal até aqui é um clique que acabou de valer).
  if (!node) redirect("/admin/conteudo");
  // Link e divisória não têm tela — só existem na árvore.
  if (node.type !== "article" && node.type !== "folder") redirect("/admin/conteudo");

  // A árvore lateral é SEMPRE a do espaço do nó (não a do espaço padrão),
  // senão a seleção "perde a referência" e clicar abre o nó errado.
  const [{ data: nodeSpace }, slugPaths, ownTree, embeddedIds, ontologyIds, pendingDraftIds] = await Promise.all([
    supabase
      .from("spaces")
      .select("id, slug, name, type, visibility, theme")
      .eq("id", node.space_id)
      .single(),
    slugPathsOf(node.space_id),
    listTree(node.space_id),
    embeddedNodeIds(node.space_id),
    ontologyNodeIds(node.space_id),
    pendingDraftNodeIds(node.space_id),
  ]);

  const [spaces, canCreateSpace, canManageSpace] = await Promise.all([
    listSpaces(),
    hasPermission("space.create"),
    hasPermission("space.manage", node.space_id),
  ]);

  // Contexto CLIENTE: um nó GLOBAL aberto a partir de uma documentação-cliente
  // que o HERDA (?space=cliente). O item herdado (id = nó global) é mostrado em
  // SÓ LEITURA + "Customizar"; a árvore lateral é a do CLIENTE.
  let herdado: { clientSpaceId: string; hidden: boolean } | null = null;
  if (spaceParam && spaceParam !== node.space_id) {
    const { data: cs } = await supabase
      .from("spaces")
      .select("id, type, parent_space_id")
      .eq("id", spaceParam)
      .maybeSingle();
    if (cs?.type === "client" && cs.parent_space_id === node.space_id) {
      const { data: ov } = await supabase
        .from("space_overlays")
        .select("override_node_id, hidden")
        .eq("space_id", spaceParam)
        .eq("source_node_id", nodeId)
        .maybeSingle();
      // Já customizado → vai direto para o fork editável.
      if (ov?.override_node_id) redirect(`/admin/conteudo/${ov.override_node_id}?space=${spaceParam}`);
      herdado = { clientSpaceId: spaceParam, hidden: !!ov?.hidden };
    }
  }
  const treeSpaceId = herdado ? herdado.clientSpaceId : node.space_id;

  const tree =
    herdado || nodeSpace?.type === "client" ? (
      <ClientTree clientSpaceId={treeSpaceId} nodes={await getEffectiveTreeAdmin(treeSpaceId)} />
    ) : (
      <Tree
        spaceId={node.space_id}
        nodes={ownTree}
        selectedId={nodeId}
        spaces={spaces}
        embeddedIds={embeddedIds}
        ontologyIds={ontologyIds}
        pendingDraftIds={pendingDraftIds}
      />
    );

  const aside = (
    <>
      <SpaceSwitcher
        spaces={spaces}
        currentId={treeSpaceId}
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
      <ContentShell titulo={node?.title ?? "Editor de conteúdo"} aside={aside}>
        {herdado && (
          <div className="mx-auto max-w-3xl">
            <CustomizeBanner
              clientSpaceId={herdado.clientSpaceId}
              globalNodeId={nodeId}
              hidden={herdado.hidden}
            />
          </div>
        )}
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
          canEdit={herdado ? false : canEdit}
          canPublish={herdado ? false : canPublish}
        />
      </ContentShell>
    );
  }

  // ── Artigo: editor de blocos ─────────────────────────────────────────────
  const [{ data: article }, { data: draft }] = await Promise.all([
    supabase.from("articles").select("content_json").eq("node_id", nodeId).maybeSingle(),
    supabase.from("article_drafts").select("content_json").eq("node_id", nodeId).maybeSingle(),
  ]);

  // Artigo HERDADO (contexto cliente): SÓ LEITURA (o conteúdo é do global; editar
  // aqui afetaria todos os clientes). "Customizar" faz o fork editável.
  if (herdado) {
    const doc = normalizeDoc(article?.content_json ?? null);
    const tema = resolveTheme(nodeSpace?.theme);
    return (
      <ContentShell titulo={node?.title ?? "Editor de conteúdo"} aside={aside} defaultCollapsed>
        <div className="mx-auto max-w-prose">
          <CustomizeBanner
            clientSpaceId={herdado.clientSpaceId}
            globalNodeId={nodeId}
            hidden={herdado.hidden}
          />
          <article className="leitura" data-size={tema.article.fontSize}>
            <h1 className="text-[length:var(--l-page,1.5rem)] font-bold leading-[1.15] tracking-tight">
              {node.title}
            </h1>
            <div className="mt-4">
              <RenderBlocks blocks={doc.blocks} snippets={new Map()} />
            </div>
          </article>
        </div>
      </ContentShell>
    );
  }

  const [canRestore, canPublish, canApprove, canReject, canComment, canDeletePerm] = await Promise.all([
    hasPermission("content.restore", node.space_id),
    hasPermission("content.publish", node.space_id),
    hasPermission("review.approve", node.space_id),
    hasPermission("review.reject", node.space_id),
    hasPermission("review.comment", node.space_id),
    hasPermission("content.delete", node.space_id),
  ]);

  // Um artigo CUSTOMIZADO (fork num espaço-cliente) não pode ser "excluído" pelo
  // editor: apagar só o nó deixaria o overlay apontando para um nó morto e o
  // item sumiria da árvore sem volta. O caminho certo dele é "Reverter" (na
  // árvore do cliente). Exclusivos e artigos próprios não têm overlay → livres.
  let isCustomizado = false;
  if (nodeSpace?.type === "client") {
    const { data: forkOverlay } = await supabase
      .from("space_overlays")
      .select("space_id")
      .eq("override_node_id", nodeId)
      .maybeSingle();
    isCustomizado = !!forkOverlay;
  }
  const canDelete = canDeletePerm && !isCustomizado;

  return (
    <ContentShell titulo={node?.title ?? "Editor de conteúdo"} aside={aside} defaultCollapsed>
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
        canDelete={canDelete}
        readingSize={resolveTheme(nodeSpace?.theme).article.fontSize}
        nodeDescription={node.description}
        nodeSlug={node.slug}
        nodeIcon={node.icon}
      />
    </ContentShell>
  );
}
