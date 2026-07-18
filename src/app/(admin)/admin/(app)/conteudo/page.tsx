import type { Metadata } from "next";
import { hasPermission } from "@/lib/auth/permissions";
import { getDefaultSpace, listTree } from "@/lib/content/tree";
import { listSpaces } from "@/lib/content/spaces";
import { getEffectiveTreeAdmin } from "@/lib/content/overlays";
import { env } from "@/lib/env";
import { ContentShell } from "@/components/content/content-shell";
import { SpaceSwitcher } from "@/components/content/space-switcher";
import { SpacePublicUrl } from "@/components/content/space-public-url";
import { Tree } from "@/components/content/tree";
import { ClientTree } from "@/components/content/client-tree";

export const metadata: Metadata = { title: "Conteúdo" };

function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border text-center">
      <div className="max-w-sm p-8">
        <h2 className="text-lg font-semibold">Selecione ou crie um artigo</h2>
        <p className="mt-2 text-sm text-text-muted">
          Troque de espaço no seletor acima. Em um espaço-cliente, os artigos
          globais aparecem como <strong>Herdado</strong> — use “Customizar” para
          criar uma versão exclusiva.
        </p>
      </div>
    </div>
  );
}

export default async function ConteudoPage({
  searchParams,
}: {
  searchParams: Promise<{ space?: string }>;
}) {
  if (!(await hasPermission("content.view"))) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Conteúdo</h1>
        <p className="mt-2 text-text-muted">Sem permissão para ver conteúdo.</p>
      </div>
    );
  }

  const [spaces, global] = await Promise.all([listSpaces(), getDefaultSpace()]);
  if (!global) return <div className="p-8 text-text-muted">Nenhum espaço.</div>;

  const { space: spaceParam } = await searchParams;
  const current =
    spaces.find((s) => s.id === spaceParam) ??
    spaces.find((s) => s.id === global.id) ??
    spaces.find((s) => s.type === "global") ??
    spaces[0];
  if (!current) return <div className="p-8 text-text-muted">Nenhum espaço.</div>;
  const [canCreate, canExport] = await Promise.all([
    hasPermission("space.create"),
    hasPermission("content.restore", current.id),
  ]);

  const switcher = (
    <>
      <SpaceSwitcher spaces={spaces} currentId={current.id} canCreate={canCreate} />
      <SpacePublicUrl
        siteUrl={env.NEXT_PUBLIC_SITE_URL}
        spaceId={current.id}
        slug={current.slug}
        name={current.name}
        type={current.type}
        visibility={current.visibility}
        customDomain={current.custom_domain}
        canExport={canExport}
      />
    </>
  );

  if (current.type === "client") {
    const eff = await getEffectiveTreeAdmin(current.id);
    return (
      <ContentShell aside={<>{switcher}<ClientTree clientSpaceId={current.id} nodes={eff} /></>}>
        <EmptyState />
      </ContentShell>
    );
  }

  const tree = await listTree(current.id);
  return (
    <ContentShell aside={<>{switcher}<Tree spaceId={current.id} nodes={tree} /></>}>
      <EmptyState />
    </ContentShell>
  );
}
