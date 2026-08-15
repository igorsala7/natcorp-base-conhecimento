import Link from "next/link";
import Script from "next/script";
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
import { PortalTracker } from "@/components/portal/portal-tracker";
import { EditAffordance } from "@/components/portal/edit-affordance";
import { SocialIcon } from "@/components/portal/social-icons";
import type { PortalTreeNode } from "@/lib/portal/data";
import { resolveTheme } from "@/lib/portal/theme";
import { derivarVarianteEscura, derivarHover } from "@/lib/portal/brand-color";
import { comBase } from "@/lib/base-path";

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
      // Link INTERNO configurado no tema ("/docs/x") precisa do prefixo do app: um
      // <a> cru não recebe o basePath do Next, e sob /natcorp/ia cairia fora.
      href={externo ? link.url : comBase(link.url)}
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
  track,
  children,
}: {
  space: ShellSpace;
  tree: PortalTreeNode[];
  activePath: string;
  /** "Nesta página" — só os atalhos dos DIRETÓRIOS desta página (não os artigos). */
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
  /**
   * Rastreio da página (documentação/diretório/artigo). Presente só nas páginas
   * que devem registrar acesso — a 404 e o gate de senha omitem, e nada é logado.
   */
  track?: { nodeId: string | null; kind: "home" | "folder" | "article"; title: string };
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
      {/* GA4 por documentação (Aparência → Integrações). Só o Measurement ID,
          validado no schema do tema — snippet livre nunca entra (XSS). */}
      {tema.tracking.ga4 && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${tema.tracking.ga4}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${tema.tracking.ga4}');`}
          </Script>
        </>
      )}
      <ReadingProgress />
      {track && (
        <PortalTracker
          spaceSlug={space.slug}
          nodeId={track.nodeId}
          kind={track.kind}
          title={track.title}
          path={activePath}
        />
      )}

      {/* Cabeçalho leve: hairline apenas, sem sombra — quem separa é o ar. */}
      <header className="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur-md supports-[backdrop-filter]:bg-bg/65">
        <div
          className="mx-auto flex max-w-[80rem] items-center justify-between gap-3 px-6"
          style={{ height: tema.header.height }}
        >
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
                // Logo cresce junto com a barra (altura - respiro), para poder
                // ganhar destaque quando o cabeçalho é aumentado.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={tema.brand.logoUrl}
                  alt={space.name}
                  className="w-auto max-w-[14rem] shrink-0 object-contain"
                  style={{ height: Math.min(96, Math.max(20, tema.header.height - 24)) }}
                />
              ) : (
                <span
                  className="flex shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-fg"
                  style={{
                    height: Math.min(96, Math.max(20, tema.header.height - 24)),
                    width: Math.min(96, Math.max(20, tema.header.height - 24)),
                  }}
                >
                  N
                </span>
              )}
              {tema.header.showTitle && <span className="truncate">{space.name}</span>}
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
        {/* Grid: 220px (árvore) | conteúdo | 200px ("Nesta página" — diretórios).
            Abaixo de lg vira coluna única (a árvore fica no drawer mobile). As
            colunas laterais só entram no template quando existem. */}
        <div
          className={`mx-auto max-w-[80rem] px-6 py-8${
            mostrarNav || (toc && toc.length > 0)
              ? ` lg:grid lg:gap-8 ${
                  mostrarNav && toc && toc.length > 0
                    ? "lg:grid-cols-[220px_minmax(0,1fr)_200px]"
                    : mostrarNav
                      ? "lg:grid-cols-[220px_minmax(0,1fr)]"
                      : "lg:grid-cols-[minmax(0,1fr)_200px]"
                }`
              : ""
          }`}
        >
          {mostrarNav && (
            <aside className="hidden lg:block">
              {/* pb-16: folga após o último item da árvore — fica clicável com
                  conforto e não cola na borda inferior da área de scroll. */}
              <div className="sticky top-20 max-h-[calc(100dvh-5rem)] overflow-y-auto pb-16 pr-2">
                <PortalNav spaceSlug={space.slug} tree={tree} activePath={activePath} />
              </div>
            </aside>
          )}

          {/* Sem árvore, o conteúdo se centraliza numa medida legível em vez de
              esticar pelos 80rem do contêiner. */}
          <main
            className={
              mostrarNav
                ? "min-w-0"
                : width === "wide"
                  ? "mx-auto min-w-0 w-full max-w-5xl"
                  : "mx-auto min-w-0 w-full max-w-3xl"
            }
          >
            {toc && toc.length > 0 && (
              <details className="mb-8 rounded-lg border border-border lg:hidden">
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
            <aside className="hidden lg:block">
              <div className="sticky top-20 max-h-[calc(100dvh-5rem)] overflow-y-auto">
                <p className="mb-2 px-2 text-2xs font-semibold uppercase tracking-wider text-text-muted">
                  Nesta página
                </p>
                <Toc items={toc} />
              </div>
            </aside>
          )}
        </div>
      </ActiveArticleProvider>

      {(tema.footer.text || tema.footer.links.length > 0 || tema.footer.social.length > 0) && (
        <footer className="border-t border-border">
          <div className="mx-auto max-w-[80rem] px-6 py-10">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-between">
              {/* Identidade + descrição institucional */}
              <div className="max-w-md text-center sm:text-left">
                <div className="mb-2 flex items-center justify-center gap-2 sm:justify-start">
                  {tema.brand.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={tema.brand.logoUrl} alt={space.name} className="h-6 w-auto max-w-[9rem] object-contain" />
                  ) : (
                    <span className="text-sm font-semibold">{space.name}</span>
                  )}
                </div>
                {tema.footer.text && (
                  <p className="text-sm leading-relaxed text-text-muted">{tema.footer.text}</p>
                )}
              </div>

              {/* Redes sociais */}
              {tema.footer.social.length > 0 && (
                <nav aria-label="Redes sociais" className="flex flex-wrap items-center justify-center gap-2">
                  {tema.footer.social.map((s) => {
                    const externo = /^https?:\/\//.test(s.url);
                    return (
                      <a
                        key={`${s.network}-${s.url}`}
                        href={s.url}
                        aria-label={s.network}
                        title={s.network}
                        {...(externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                        className="flex size-9 items-center justify-center rounded-full border border-border text-text-muted transition-colors hover:border-primary hover:text-primary"
                      >
                        <SocialIcon network={s.network} />
                      </a>
                    );
                  })}
                </nav>
              )}
            </div>

            {/* Copyright + links do rodapé */}
            <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 sm:flex-row">
              <p className="text-xs text-text-muted">
                © {new Date().getFullYear()} {space.name}. Todos os direitos reservados.
              </p>
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
          </div>
        </footer>
      )}

      <PortalAssistant spaceSlug={space.slug} supportUrl={supportUrl} sugestoes={tema.ia.sugestoes} />
      {/* Só aparece para quem pode editar — a checagem é no navegador, então o
          HTML entregue é o mesmo para todos e a rota segue anônima. */}
      <EditAffordance spaceId={space.id} nodeId={activeNodeId} />
    </div>
  );
}

/** Trilha de navegação (breadcrumbs). `current` é a página atual, sem link. */
export function Breadcrumbs({
  spaceSlug,
  spaceName,
  crumbs,
  current,
}: {
  spaceSlug: string;
  spaceName: string;
  crumbs: PortalTreeNode[];
  current?: string;
}) {
  return (
    <nav
      aria-label="Trilha"
      className="mb-5 flex flex-wrap items-center gap-1.5 text-xs text-text-muted"
    >
      <Link href={`/docs/${spaceSlug}`} className="rounded-sm transition-colors hover:text-primary">
        {spaceName}
      </Link>
      {crumbs.map((c) => (
        <span key={c.id} className="flex items-center gap-1.5">
          <ChevronRight className="size-3.5 text-brand-gray-300 dark:text-brand-gray-600" />
          <Link
            href={`/docs/${spaceSlug}/${c.slugPath.join("/")}`}
            className="rounded-sm transition-colors hover:text-primary"
          >
            {c.title}
          </Link>
        </span>
      ))}
      {current && (
        <span className="flex items-center gap-1.5">
          <ChevronRight className="size-3.5 text-brand-gray-300 dark:text-brand-gray-600" />
          <span aria-current="page" className="font-semibold text-text">
            {current}
          </span>
        </span>
      )}
    </nav>
  );
}
