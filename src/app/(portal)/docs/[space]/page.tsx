import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicSpace, getPortalTree } from "@/lib/portal/data";
import { PortalShell } from "@/components/portal/shell";

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

export default async function SpaceHome({
  params,
}: {
  params: Promise<{ space: string }>;
}) {
  const { space: spaceSlug } = await params;
  const space = await getPublicSpace(spaceSlug);
  if (!space) notFound();
  const tree = await getPortalTree(space.id);

  return (
    <PortalShell space={space} tree={tree} activePath="">
      <div className="mx-auto max-w-prose">
        <h1 className="text-3xl font-bold tracking-tight">{space.name}</h1>
        <p className="mt-3 text-text-muted">Navegue pela documentação.</p>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {tree
            .filter((n) => n.type !== "divider")
            .map((n) => (
              <li key={n.id}>
                <Link
                  href={`/docs/${spaceSlug}/${n.slugPath.join("/")}`}
                  className="block rounded-lg border border-border p-4 no-underline transition hover:border-primary"
                >
                  <div className="font-semibold">{n.title}</div>
                </Link>
              </li>
            ))}
        </ul>
      </div>
    </PortalShell>
  );
}
