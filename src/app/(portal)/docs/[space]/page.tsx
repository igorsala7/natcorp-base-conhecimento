import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import {
  getPublicSpace,
  getPortalTree,
  getPortalAccess,
  flattenPortalTree,
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
  const recent = flattenPortalTree(tree)
    .filter((n) => n.type === "article")
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
    .slice(0, 6);

  const { supportUrl, tema } = spaceChrome(space);

  const dados: DadosHome = {
    spaceName: space.name,
    categorias: categories.map((f) => ({
      id: f.id,
      title: f.title,
      href: `/docs/${spaceSlug}/${f.slugPath.join("/")}`,
      artigos: countArticles(f),
    })),
    artigosSoltos: looseArticles.map((a) => ({
      id: a.id,
      title: a.title,
      href: `/docs/${spaceSlug}/${a.slugPath.join("/")}`,
    })),
    recentes: recent.map((a) => ({
      id: a.id,
      title: a.title,
      href: `/docs/${spaceSlug}/${a.slugPath.join("/")}`,
      updatedAt: a.updated_at,
    })),
    supportUrl,
  };

  return (
    <PortalShell space={space} tree={tree} activePath="" nav={false}>
      <SpaceHomeView tema={tema} dados={dados} />
    </PortalShell>
  );
}
