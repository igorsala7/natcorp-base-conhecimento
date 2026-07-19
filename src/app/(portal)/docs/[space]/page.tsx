import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Folder, FileText, LifeBuoy, ArrowRight } from "lucide-react";
import {
  getPublicSpace,
  getPortalTree,
  getPortalAccess,
  flattenPortalTree,
  type PortalTreeNode,
} from "@/lib/portal/data";
import { PortalShell, spaceChrome } from "@/components/portal/shell";
import { SearchTrigger, AskTrigger } from "@/components/portal/portal-search";
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
  const tree = await getPortalTree(space.id, db);
  const { supportUrl } = spaceChrome(space);

  const categories = tree.filter((n) => n.type === "folder");
  const looseArticles = tree.filter((n) => n.type === "article");
  const recent = flattenPortalTree(tree)
    .filter((n) => n.type === "article")
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
    .slice(0, 6);

  return (
    <PortalShell space={space} tree={tree} activePath="">
      {/* Hero de busca */}
      <section className="mx-auto max-w-2xl py-4 text-center sm:py-8">
        <h1 className="text-[length:var(--text-4xl)] font-bold tracking-tight">{space.name}</h1>
        <p className="mx-auto mt-3 max-w-md text-text-muted">
          Encontre respostas na documentação — ou pergunte à IA.
        </p>
        <div className="mt-6">
          <SearchTrigger variant="hero" />
        </div>
        <div className="mt-3 flex justify-center">
          <AskTrigger />
        </div>
      </section>

      {/* Categorias */}
      {(categories.length > 0 || looseArticles.length > 0) && (
        <section className="mt-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
            Categorias
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {categories.map((f) => (
              <li key={f.id}>
                <Link
                  href={`/docs/${spaceSlug}/${f.slugPath.join("/")}`}
                  className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-4 no-underline transition hover:border-primary"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-purple-50 text-primary dark:bg-brand-purple-950/40">
                    <Folder className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{f.title}</span>
                    <span className="block text-sm text-text-muted">
                      {countArticles(f)} artigo(s)
                    </span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-text-muted transition group-hover:translate-x-0.5 group-hover:text-primary" />
                </Link>
              </li>
            ))}
            {looseArticles.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/docs/${spaceSlug}/${a.slugPath.join("/")}`}
                  className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-4 no-underline transition hover:border-primary"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-text-muted">
                    <FileText className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{a.title}</span>
                  <ArrowRight className="size-4 shrink-0 text-text-muted transition group-hover:translate-x-0.5 group-hover:text-primary" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Recentemente atualizados */}
      {recent.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
            Recentemente atualizados
          </h2>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {recent.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/docs/${spaceSlug}/${a.slugPath.join("/")}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 no-underline transition hover:bg-surface-2"
                >
                  <span className="truncate text-sm">{a.title}</span>
                  <span className="shrink-0 text-xs tabular-nums text-text-muted">
                    {new Date(a.updated_at).toLocaleDateString("pt-BR")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Escalonamento */}
      <section className="mt-10 rounded-xl border border-border bg-surface-2 p-6 text-center">
        <p className="font-medium">Não encontrou o que procurava?</p>
        <p className="mt-1 text-sm text-text-muted">
          Pergunte à IA com base nesta documentação ou fale com o suporte.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <AskTrigger />
          {supportUrl && (
            <a
              href={supportUrl}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:border-primary hover:text-primary"
            >
              <LifeBuoy className="size-4" /> Falar com o suporte
            </a>
          )}
        </div>
      </section>
    </PortalShell>
  );
}
