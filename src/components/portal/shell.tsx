import Link from "next/link";
import type { CSSProperties } from "react";
import { ChevronRight, List } from "lucide-react";
import { PortalNav } from "@/components/portal/nav";
import { PortalMobileNav } from "@/components/portal/mobile-nav";
import { Toc, type TocItem } from "@/components/portal/toc";
import { ThemeToggle } from "@/components/theme-toggle";
import { PortalAssistant, SearchTrigger, AskTrigger } from "@/components/portal/portal-search";
import { ReadingProgress } from "@/components/portal/reading-progress";
import type { PortalTreeNode } from "@/lib/portal/data";

type ShellSpace = { slug: string; name: string; theme?: Record<string, unknown> | null };

/** Deriva marca e contato do `space.theme` (jsonb). */
export function spaceChrome(space: ShellSpace) {
  const theme = (space.theme ?? {}) as {
    primaryColor?: string;
    supportUrl?: string;
    supportEmail?: string;
  };
  const supportUrl =
    theme.supportUrl || (theme.supportEmail ? `mailto:${theme.supportEmail}` : undefined);
  const style = theme.primaryColor
    ? ({
        "--color-primary": theme.primaryColor,
        "--color-primary-hover": theme.primaryColor,
      } as CSSProperties)
    : undefined;
  return { supportUrl, style };
}

/** Casca do portal: header + nav (com drawer mobile) · conteúdo · TOC. */
export function PortalShell({
  space,
  tree,
  activePath,
  toc,
  children,
}: {
  space: ShellSpace;
  tree: PortalTreeNode[];
  activePath: string;
  toc?: TocItem[];
  children: React.ReactNode;
}) {
  const { supportUrl, style } = spaceChrome(space);

  return (
    <div className="min-h-dvh bg-bg text-text" style={style}>
      <ReadingProgress />

      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-2">
            <PortalMobileNav spaceSlug={space.slug} tree={tree} activePath={activePath} />
            <Link
              href={`/docs/${space.slug}`}
              className="flex min-w-0 items-center gap-2 font-semibold"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-sm text-primary-fg">
                N
              </span>
              <span className="truncate">{space.name}</span>
            </Link>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <SearchTrigger variant="header" />
            <AskTrigger />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-8 px-4 py-8">
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-auto pr-1">
            <PortalNav spaceSlug={space.slug} tree={tree} activePath={activePath} />
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          {toc && toc.length > 0 && (
            <details className="mb-6 rounded-lg border border-border xl:hidden">
              <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm font-medium text-text-muted">
                <List className="size-4" /> Nesta página
              </summary>
              <div className="border-t border-border p-3">
                <Toc items={toc} />
              </div>
            </details>
          )}
          {children}
        </main>

        {toc && toc.length > 0 && (
          <aside className="hidden w-56 shrink-0 xl:block">
            <div className="sticky top-20">
              <Toc items={toc} />
            </div>
          </aside>
        )}
      </div>

      <PortalAssistant spaceSlug={space.slug} supportUrl={supportUrl} />
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
