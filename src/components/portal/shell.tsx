import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowUpRight, ChevronRight, List } from "lucide-react";
import type { ThemeLink } from "@/lib/portal/theme";
import { PortalNav } from "@/components/portal/nav";
import { ActiveArticleProvider } from "@/components/portal/active-article";
import { PortalMobileNav } from "@/components/portal/mobile-nav";
import { Toc, type TocItem } from "@/components/portal/toc";
import { ThemeToggle } from "@/components/theme-toggle";
import { PortalAssistant, SearchTrigger, AskTrigger } from "@/components/portal/portal-search";
import { ReadingProgress } from "@/components/portal/reading-progress";
import { EditAffordance } from "@/components/portal/edit-affordance";
import type { PortalTreeNode } from "@/lib/portal/data";
import { resolveTheme } from "@/lib/portal/theme";
import { derivarVarianteEscura, derivarHover } from "@/lib/portal/brand-color";

type ShellSpace = { id: string; slug: string; name: string; theme?: Record<string, unknown> | null };

/**
 * Deriva marca e contato do `space.theme` (jsonb).
 *
 * A cor sai como PAR de variáveis (`--marca-claro` / `--marca-escuro`) e a
 * classe `tema-espaco`, e é o CSS em `globals.css` que escolhe qual vira
 * `--color-primary` conforme o tema. Estilo inline não faz media query nem
 * enxerga `.dark`; sem esse par, uma marca escura sobrescreveria também o modo
 * escuro e ficaria ilegível sobre o fundo escuro.
 */
export function spaceChrome(space: ShellSpace) {
  const tema = resolveTheme(space.theme);
  const supportUrl =
    tema.supportUrl || (tema.supportEmail ? `mailto:${tema.supportEmail}` : undefined);

  const cor = tema.brand.color;
  const style = cor
    ? ({
        "--marca-claro": cor,
        "--marca-claro-hover": derivarHover(cor),
        "--marca-escuro": derivarVarianteEscura(cor),
      } as CSSProperties)
    : undefined;

  return { supportUrl, style, tema, temaClasse: cor ? "tema-espaco" : undefined };
}

/** Link do tema no cabeçalho/rodapé. Externo abre em nova aba, com ícone. */
function ThemeLinkAnchor({ link, className }: { link: ThemeLink; className: string }) {
  const externo = /^https?:\/\//.test(link.url);
  return (
    <a
      href={link.url}
      className={className}
      {...(externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {link.label}
      {externo && <ArrowUpRight className="size-3.5 opacity-60" />}
    </a>
  );
}

/** Casca do portal: header + nav (com drawer mobile) · conteúdo · TOC. */
export function PortalShell({
  space,
  tree,
  activePath,
  toc,
  nav = true,
  width = "prose",
  activeNodeId,
  children,
}: {
  space: ShellSpace;
  tree: PortalTreeNode[];
  activePath: string;
  toc?: TocItem[];
  /**
   * Árvore lateral. Desligada na home do espaço, onde ela seria redundante
   * (as categorias já são o conteúdo da página) e roubaria a largura da
   * abertura. Prop explícita e não derivada de `activePath`: a página 404
   * também chega aqui com `activePath` vazio e ali a árvore ajuda.
   */
  nav?: boolean;
  /**
   * Largura do conteúdo quando NÃO há árvore lateral: `prose` centraliza numa
   * medida de leitura; `wide` dá espaço para a home respirar (faixa do hero e
   * grade de categorias).
   */
  width?: "prose" | "wide";
  /** Artigo em foco — o atalho de edição cai direto nele na prévia. */
  activeNodeId?: string | null;
  children: React.ReactNode;
}) {
  const { supportUrl, style, tema, temaClasse } = spaceChrome(space);
  const mostrarNav = nav && tree.length > 0;
  // O drawer mobile também abre onde a árvore lateral está desligada (a home),
  // desde que exista o que mostrar — senão os links do cabeçalho, escondidos
  // em telas pequenas, ficariam inalcançáveis no celular.
  const mostrarDrawer = mostrarNav || tema.header.links.length > 0;

  return (
    <div className={`min-h-dvh bg-bg text-text${temaClasse ? ` ${temaClasse}` : ""}`} style={style}>
      <ReadingProgress />

      {/* Cabeçalho leve: hairline apenas, sem sombra — quem separa é o ar. */}
      <header className="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur-md supports-[backdrop-filter]:bg-bg/65">
        <div className="mx-auto flex h-14 max-w-[90rem] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2">
            {mostrarDrawer && (
              <PortalMobileNav
                spaceSlug={space.slug}
                tree={mostrarNav ? tree : []}
                activePath={activePath}
                links={tema.header.links}
              />
            )}
            <Link
              href={`/docs/${space.slug}`}
              className="flex min-w-0 items-center gap-2.5 rounded-sm text-[0.9375rem] font-semibold tracking-tight"
            >
              {tema.brand.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={tema.brand.logoUrl}
                  alt={space.name}
                  className="h-7 w-auto max-w-[10rem] shrink-0 object-contain"
                />
              ) : (
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-fg">
                  N
                </span>
              )}
              <span className="truncate">{space.name}</span>
            </Link>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {tema.header.links.length > 0 && (
              <nav aria-label="Links do site" className="mr-2 hidden items-center gap-1 md:flex">
                {tema.header.links.map((l) => (
                  <ThemeLinkAnchor
                    key={`${l.label}-${l.url}`}
                    link={l}
                    className="flex items-center gap-0.5 rounded-md px-2 py-1.5 text-sm text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
                  />
                ))}
              </nav>
            )}
            <SearchTrigger variant="header" />
            <AskTrigger />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Provider client: liga o scroll do conteúdo ao destaque na árvore. */}
      <ActiveArticleProvider>
        <div className="mx-auto flex max-w-[90rem] gap-8 px-4 py-10 sm:px-6 lg:gap-12 lg:px-8 lg:py-14">
          {mostrarNav && (
            <aside className="hidden w-60 shrink-0 lg:block xl:w-64">
              <div className="sticky top-14 max-h-[calc(100dvh-3.5rem)] overflow-y-auto py-4 pr-2">
                <PortalNav spaceSlug={space.slug} tree={tree} activePath={activePath} />
              </div>
            </aside>
          )}

          {/* Sem árvore, o conteúdo se centraliza numa medida legível em vez de
              esticar pelos 90rem do contêiner. */}
          <main
            className={
              mostrarNav
                ? "min-w-0 flex-1"
                : width === "wide"
                  ? "mx-auto min-w-0 w-full max-w-5xl"
                  : "mx-auto min-w-0 w-full max-w-3xl"
            }
          >
            {toc && toc.length > 0 && (
              <details className="mb-8 rounded-lg border border-border xl:hidden">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-medium text-text-muted">
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
              {/* max-h + scroll: sem isto, um índice longo estoura a viewport
                  e os últimos itens ficam inalcançáveis. */}
              <div className="sticky top-14 max-h-[calc(100dvh-3.5rem)] overflow-y-auto py-4">
                <Toc items={toc} />
              </div>
            </aside>
          )}
        </div>
      </ActiveArticleProvider>

      {(tema.footer.text || tema.footer.links.length > 0) && (
        <footer className="border-t border-border">
          <div className="mx-auto flex max-w-[90rem] flex-col items-center justify-between gap-3 px-4 py-8 sm:flex-row sm:px-6 lg:px-8">
            <p className="text-sm text-text-muted">{tema.footer.text ?? space.name}</p>
            {tema.footer.links.length > 0 && (
              <nav aria-label="Links do rodapé" className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1">
                {tema.footer.links.map((l) => (
                  <ThemeLinkAnchor
                    key={`${l.label}-${l.url}`}
                    link={l}
                    className="flex items-center gap-0.5 rounded-md px-2 py-1 text-sm text-text-muted transition-colors hover:text-text"
                  />
                ))}
              </nav>
            )}
          </div>
        </footer>
      )}

      <PortalAssistant spaceSlug={space.slug} supportUrl={supportUrl} />
      {/* Só aparece para quem pode editar — a checagem é no navegador, então o
          HTML entregue é o mesmo para todos e a rota segue anônima. */}
      <EditAffordance spaceId={space.id} nodeId={activeNodeId} />
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
      className="flex flex-wrap items-center gap-1 text-[0.8125rem] text-text-muted"
    >
      <Link href={`/docs/${spaceSlug}`} className="rounded-sm transition-colors hover:text-text">
        {spaceName}
      </Link>
      {crumbs.map((c) => (
        <span key={c.id} className="flex items-center gap-1">
          <ChevronRight className="size-3.5 opacity-50" />
          <Link
            href={`/docs/${spaceSlug}/${c.slugPath.join("/")}`}
            className="rounded-sm transition-colors hover:text-text"
          >
            {c.title}
          </Link>
        </span>
      ))}
    </nav>
  );
}
