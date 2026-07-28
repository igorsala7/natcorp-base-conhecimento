import type { Metadata } from "next";
import { getPublicSpace, getPortalTree, resolveByPath } from "@/lib/portal/data";
import { EmbedView } from "@/components/portal/embed-view";

type Params = { space: string; path: string[] };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { space: spaceSlug, path } = await params;
  const space = await getPublicSpace(spaceSlug);
  if (!space) return { title: "Não encontrado", robots: { index: false, follow: false } };
  const tree = await getPortalTree(space.id);
  const node = resolveByPath(tree, path);
  return { title: node ? `${node.title} · ${space.name}` : space.name, robots: { index: false, follow: false } };
}

export default async function EmbedPathPage({ params }: { params: Promise<Params> }) {
  const { space, path } = await params;
  return <EmbedView spaceSlug={space} path={path} />;
}
