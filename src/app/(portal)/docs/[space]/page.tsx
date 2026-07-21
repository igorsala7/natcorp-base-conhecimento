import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import {
  getPublicSpace,
  getPortalTree,
  getPortalAccess,
  flattenPortalTree,
  getArticleExcerpts,
  getTopHelpful,
  type PortalTreeNode,
} from "@/lib/portal/data";
import { PortalShell, spaceChrome } from "@/components/portal/shell";
import { SpaceHomeView, type DadosHome } from "@/components/portal/space-home";
import { PasswordGate } from "@/components/portal/password-gate";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ space: string }>;
}): Promise<Metadata> {
  const { space: spaceSlug } = await params;
  const space = await getPublicSpace(spaceSlug);
  if (!space) return { title: "Não encontrado" };
  return {
    title: space.name,
    openGraph: {
      title: space.name,
      images: [
        { url: `/api/og?space=${encodeURIComponent(spaceSlug)}`, width: 1200, height: 630 },
      ],
    },
  };
}

/** Conta artigos publicados em toda a subárvore de uma pasta. */
function countArticles(node: PortalTreeNode): number {
  return node.children.reduce(
    (n, c) => n + (c.type === "article" ? 1 : 0) + countArticles(c),
    0,
  );
}

export default async function SpaceHome({
  params,
}: {
  params: Promise<{ space: string }>;
}) {
  const { space: spaceSlug } = await params;
  const access = await getPortalAccess(spaceSlug);
  if (!access) notFound();
  if (access.locked) return <PasswordGate spaceSlug={spaceSlug} spaceName={access.space.name} />;
  const { space, db } = access;

  // Slug aposentada → 301 para a atual (ver `resolvePortalSpace`).
  if (space.slug !== spaceSlug) permanentRedirect(`/docs/${space.slug}`);
  const tree = await getPortalTree(space.id, db);

  const categories = tree.filter((n) => n.type === "folder");
  const looseArticles = tree.filter((n) => n.type === "article");
  const flat = flattenPortalTree(tree);
  const artigos = flat.filter((n) => n.type === "article");
  const recent = [...artigos]
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
    .slice(0, 6);

  const { supportUrl, tema } = spaceChrome(space);
  const href = (n: PortalTreeNode) => `/docs/${spaceSlug}/${n.slugPath.join("/")}`;

  // Destaques: ids curados no tema → só os que ainda existem E estão
  // publicados nesta árvore, na ordem escolhida no admin.
  const porId = new Map(artigos.map((n) => [n.id, n]));
  const idsDestaque = tema.home.featured.filter((id) => porId.has(id));
  const excerpts = await getArticleExcerpts(idsDestaque, db);
  const destaques = idsDestaque.map((id) => {
    const n = porId.get(id)!;
    return { id, title: n.title, href: href(n), excerpt: excerpts.get(id) ?? null };
  });

  // "Mais úteis": agregado de feedback via RPC (anon não lê a tabela crua).
  const maisUteis = (await getTopHelpful(space.id, db))
    .map((r) => porId.get(r.node_id))
    .filter((n): n is PortalTreeNode => !!n)
    .map((n) => ({ id: n.id, title: n.title, href: href(n) }));

  const dados: DadosHome = {
    spaceName: space.name,
    categorias: categories.map((f) => ({
      id: f.id,
      title: f.title,
      href: href(f),
      artigos: countArticles(f),
      icon: f.icon,
      descricao: f.description,
    })),
    artigosSoltos: looseArticles.map((a) => ({
      id: a.id,
      title: a.title,
      href: href(a),
      icon: a.icon,
    })),
    recentes: recent.map((a) => ({
      id: a.id,
      title: a.title,
      href: href(a),
      updatedAt: a.updated_at,
    })),
    destaques,
    maisUteis,
    supportUrl,
  };

  return (
    <PortalShell space={space} tree={tree} activePath="" nav={false} width="wide">
      <SpaceHomeView tema={tema} dados={dados} />
    </PortalShell>
  );
}
