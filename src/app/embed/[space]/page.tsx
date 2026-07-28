import type { Metadata } from "next";
import { getPublicSpace } from "@/lib/portal/data";
import { EmbedView } from "@/components/portal/embed-view";

type Params = { space: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { space: spaceSlug } = await params;
  const space = await getPublicSpace(spaceSlug);
  return { title: space?.name ?? "Não encontrado", robots: { index: false, follow: false } };
}

export default async function EmbedRootPage({ params }: { params: Promise<Params> }) {
  const { space } = await params;
  return <EmbedView spaceSlug={space} path={[]} />;
}
