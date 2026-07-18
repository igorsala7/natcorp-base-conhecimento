import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PortalNav } from "@/components/portal/nav";
import { Toc, type TocItem } from "@/components/portal/toc";
import { ThemeToggle } from "@/components/theme-toggle";
import type { PortalTreeNode } from "@/lib/portal/data";

/** Casca de três colunas do portal: nav · conteúdo · TOC. Responsiva. */
export function PortalShell({
  space,
  tree,
  activePath,
  toc,
  children,
}: {
  space: { slug: string; name: string };
  tree: PortalTreeNode[];
  activePath: string;
  toc?: TocItem[];
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-bg text-text">
      <header className="sticky top-0 z-10 border-b border-border bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4">
          <Link
            href={`/docs/${space.slug}`}
            className="flex items-center gap-2 font-semibold"
          >
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-sm text-primary-fg">
              N
            </span>
            {space.name}
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-8 px-4 py-8">
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-auto">
            <PortalNav spaceSlug={space.slug} tree={tree} activePath={activePath} />
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>

        {toc && toc.length > 0 && (
          <aside className="hidden w-56 shrink-0 xl:block">
            <div className="sticky top-20">
              <Toc items={toc} />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

/** Trilha de navegação (breadcrumbs). */
export function Breadcrumbs({
  spaceSlug,
  spaceName,
  crumbs,
}: {
  spaceSlug: string;
  spaceName: string;
  crumbs: PortalTreeNode[];
}) {
  return (
    <nav
      aria-label="Trilha"
      className="flex flex-wrap items-center gap-1 text-sm text-text-muted"
    >
      <Link href={`/docs/${spaceSlug}`} className="hover:text-text">
        {spaceName}
      </Link>
      {crumbs.map((c) => (
        <span key={c.id} className="flex items-center gap-1">
          <ChevronRight className="size-3.5" />
          <Link
            href={`/docs/${spaceSlug}/${c.slugPath.join("/")}`}
            className="hover:text-text"
          >
            {c.title}
          </Link>
        </span>
      ))}
    </nav>
  );
}
