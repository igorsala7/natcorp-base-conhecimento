import type { Metadata } from "next";
import { FileText, FolderPlus, MousePointer2, Sparkles } from "lucide-react";
import { hasPermission } from "@/lib/auth/permissions";
import { getDefaultSpace, listTree, embeddedNodeIds, ontologyNodeIds, pendingDraftNodeIds } from "@/lib/content/tree";
import { listSpaces } from "@/lib/content/spaces";
import { resolvedSpaceId } from "@/lib/content/current-space";
import { getEffectiveTreeAdmin } from "@/lib/content/overlays";
import { env } from "@/lib/env";
import { EmptyState } from "@/components/ui/empty-state";
import { ContentShell } from "@/components/content/content-shell";
import { SpaceSwitcher } from "@/components/content/space-switcher";
import { SpacePublicUrl } from "@/components/content/space-public-url";
import { Tree } from "@/components/content/tree";
import { ClientTree } from "@/components/content/client-tree";
import { SemPermissao } from "@/components/ui/sem-permissao";

export const metadata: Metadata = { title: "Conteúdo" };

function ConteudoVazio() {
  const tips = [
    { icon: MousePointer2, text: "Selecione um artigo na árvore ao lado para editá-lo." },
    { icon: FolderPlus, text: "Crie pastas e artigos com os botões no topo da árvore." },
    { icon: Sparkles, text: "No editor, tecle “/” para inserir qualquer bloco." },
  ];
  return (
    <EmptyState
      icon={FileText}
      title="Comece a documentar"
      description="Organize a documentação em uma árvore de pastas e artigos."
      className="h-full justify-center rounded-xl"
      action={
        <ul className="mx-auto max-w-sm space-y-2 text-left">
          {tips.map((t) => {
            const Icon = t.icon;
            return (
              <li key={t.text} className="flex items-start gap-2.5 text-sm text-text-muted">
                <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{t.text}</span>
              </li>
            );
          })}
        </ul>
      }
    />
  );
}

export default async function ConteudoPage({
  searchParams,
}: {
  searchParams: Promise<{ space?: string }>;
}) {
  if (!(await hasPermission("content.view"))) {
    return (
      <SemPermissao
        titulo="Conteúdo"
        oQue="ver conteúdo"
        permissao="content.view"
        papel="Leitor"
      />
    );
  }

  const [spaces, global] = await Promise.all([listSpaces(), getDefaultSpace()]);
  if (!global) return <div className="p-8 text-text-muted">Nenhum espaço.</div>;

  const { space: spaceParam } = await searchParams;
  // Persistente entre telas: URL → cookie (última escolhida) → global → 1º.
  const resolvido = await resolvedSpaceId(spaceParam, spaces);
  const current =
    spaces.find((s) => s.id === resolvido) ??
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
        <ConteudoVazio />
      </ContentShell>
    );
  }

  const [tree, embeddedIds, ontologyIds, pendingDraftIds] = await Promise.all([
    listTree(current.id),
    embeddedNodeIds(current.id),
    ontologyNodeIds(current.id),
    pendingDraftNodeIds(current.id),
  ]);
  return (
    <ContentShell
      aside={
        <>
          {switcher}
          <Tree
            spaceId={current.id}
            nodes={tree}
            spaces={spaces}
            siteUrl={env.NEXT_PUBLIC_SITE_URL}
            embeddedIds={embeddedIds}
            ontologyIds={ontologyIds}
            pendingDraftIds={pendingDraftIds}
          />
        </>
      }
    >
      <ConteudoVazio />
    </ContentShell>
  );
}
