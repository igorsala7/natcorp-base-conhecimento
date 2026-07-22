import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ArrowRight, Clock, Eye } from "lucide-react";
import {
  getPublicSpace,
  getPortalTree,
  getPortalAccess,
  resolveByPath,
  findRedirect,
  flattenPortalTree,
  ancestorsOf,
  getPublicArticle,
  getPublicArticles,
  getPublicSnippets,
  getRelatedArticles,
  getArticleBylines,
} from "@/lib/portal/data";
import { RenderBlocks, extractToc } from "@/lib/blocks/render";
import { normalizeDoc } from "@/lib/blocks/convert";
import { blocksToText } from "@/lib/blocks/serialize";
import { PortalShell, Breadcrumbs, spaceChrome } from "@/components/portal/shell";
import { SearchTrigger, AskTrigger } from "@/components/portal/portal-search";
import { PasswordGate } from "@/components/portal/password-gate";
import { OriginGate } from "@/components/portal/origin-gate";
import { OriginCookieSetter } from "@/components/portal/origin-cookie-setter";
import { makeSpaceToken } from "@/lib/portal/space-auth";
import { Feedback } from "@/components/portal/feedback";
import { ReadingScroll } from "@/components/portal/reading-scroll";

type Params = { space: string; path: string[] };
function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { space: spaceSlug, path } = await params;
  const space = await getPublicSpace(spaceSlug);
  if (!space) return { title: "Não encontrado" };
  const tree = await getPortalTree(space.id);
  const node = resolveByPath(tree, path);
  if (!node) return { title: space.name };
  const title = `${node.title} · ${space.name}`;
  const article = node.type === "article" ? await getPublicArticle(node.id) : null;
  const description = article?.excerpt ?? undefined;
  const ogUrl = `/api/og?space=${encodeURIComponent(spaceSlug)}&path=${encodeURIComponent(node.slugPath.join("/"))}`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
    alternates: { canonical: `/docs/${spaceSlug}/${node.slugPath.join("/")}` },
  };
}

export default async function DocsPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { space: spaceSlug, path } = await params;
  const access = await getPortalAccess(spaceSlug);
  if (!access) notFound();
  if (access.locked) {
    // Dois motivos de bloqueio: senha (formulário) e origem (página com o
    // tema e a mensagem parametrizada — não há o que digitar).
    if (access.reason === "origin") return <OriginGate space={access.space} />;
    return <PasswordGate spaceSlug={spaceSlug} spaceName={access.space.name} />;
  }
  const { space, db } = access;
  // Liberado pelo Referer mas ainda sem cookie: o setter invisível persiste a
  // liberação (7 dias) — recarregar e abrir em nova aba continuam funcionando.
  const originSetter = access.grantOriginCookie ? (
    <OriginCookieSetter spaceSlug={space.slug} token={makeSpaceToken(space.id)} />
  ) : null;

  // A URL veio com uma slug APOSENTADA: 301 para a atual, preservando o
  // caminho. É o que impede um link já compartilhado de morrer.
  if (space.slug !== spaceSlug) {
    permanentRedirect(`/docs/${space.slug}/${path.join("/")}`);
  }

  const tree = await getPortalTree(space.id, db);
  const node = resolveByPath(tree, path);

  if (!node) {
    const toNodeId = await findRedirect(space.id, path.join("/"), db);
    if (toNodeId) {
      const target = flattenPortalTree(tree).find((n) => n.id === toNodeId);
      if (target) {
        permanentRedirect(`/docs/${spaceSlug}/${target.slugPath.join("/")}`);
      }
    }
    // Página inexistente → resposta amigável (com busca/IA), não um beco sem saída.
    return (
      <PortalShell space={space} tree={tree} activePath="">
      {originSetter}
        <div className="mx-auto max-w-md py-16 text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-text-muted">404</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">Página não encontrada</h1>
          <p className="mt-2 text-text-muted">
            O endereço mudou ou não existe. Tente buscar ou perguntar à IA.
          </p>
          <div className="mt-6">
            <SearchTrigger variant="hero" />
          </div>
          <div className="mt-3 flex justify-center gap-2">
            <AskTrigger />
            <Link
              href={`/docs/${spaceSlug}`}
              className="inline-flex items-center rounded-lg border border-border px-3 py-1.5 text-sm hover:border-primary hover:text-primary"
            >
              Início
            </Link>
          </div>
        </div>
      </PortalShell>
    );
  }

  const activePath = path.join("/");
  const { supportUrl, tema } = spaceChrome(space);

  // LEITURA CONTÍNUA: a página é o DIRETÓRIO DE 1º NÍVEL com TODA a subárvore
  // dentro dele (artigos e subpastas, na ordem da árvore), num texto corrido só.
  // Troca de página apenas quando muda o diretório de 1º nível.
  const trilha = ancestorsOf(tree, node.id); // do topo até o próprio nó
  const groupRoot = trilha[0] ?? node;

  // Percorre a subárvore em profundidade, preservando a ordem dos irmãos:
  // artigo → seção de texto; pasta → cabeçalho de seção + seus filhos.
  type Item =
    | { kind: "folder"; node: (typeof tree)[number]; depth: number }
    | { kind: "article"; node: (typeof tree)[number]; depth: number };
  const itens: Item[] = [];
  const percorrer = (lista: typeof tree, depth: number) => {
    for (const n of lista) {
      if (n.type === "article") itens.push({ kind: "article", node: n, depth });
      else if (n.type === "folder") {
        itens.push({ kind: "folder", node: n, depth });
        percorrer(n.children, depth + 1);
      }
    }
  };
  if (groupRoot.type === "article") itens.push({ kind: "article", node: groupRoot, depth: 1 });
  else percorrer(groupRoot.children, 1);

  const artigos = itens.filter((i) => i.kind === "article").map((i) => i.node);

  // Diretório de 1º nível sem nenhum artigo na subárvore: índice de subpastas.
  if (artigos.length === 0) {
    return (
      <PortalShell space={space} tree={tree} activePath={activePath}>
      {originSetter}
        <Breadcrumbs
          spaceSlug={spaceSlug}
          crumbs={ancestorsOf(tree, node.id).slice(0, -1)}
          spaceName={space.name}
          current={node.title}
        />
        <h1 className="text-[length:var(--l-page,var(--text-4xl))] font-semibold leading-[1.1]">
          {node.title}
        </h1>
        <ul className="mt-8 divide-y divide-brand-gray-100 dark:divide-brand-gray-800">
          {node.children
            .filter((c) => c.type !== "divider")
            .map((c) => (
              <li key={c.id}>
                <Link
                  href={`/docs/${spaceSlug}/${c.slugPath.join("/")}`}
                  className="group flex items-center gap-4 px-6 py-4 no-underline transition-colors hover:bg-brand-purple-50/50 dark:hover:bg-brand-purple-950/25"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold transition-colors group-hover:text-brand-purple-700 dark:group-hover:text-brand-purple-300">
                    {c.title}
                  </span>
                </Link>
              </li>
            ))}
        </ul>
      </PortalShell>
    );
  }

  // Conteúdo de TODOS os artigos da subárvore, em LOTE (uma query só).
  const contentByNode = await getPublicArticles(artigos.map((a) => a.id), db);
  const snippets = await getPublicSnippets(space.id, db);

  // Âncoras únicas na página: o slug só é único entre irmãos, e aqui a página
  // reúne vários níveis. O prefixo isola também os títulos internos do artigo.
  const usadas = new Set<string>();
  const ancoraUnica = (base: string) => {
    let a = base;
    let i = 1;
    while (usadas.has(a)) a = `${base}-${++i}`;
    usadas.add(a);
    return a;
  };

  const sections = itens.map((item) => {
    if (item.kind === "folder") {
      return {
        kind: "folder" as const,
        node: item.node,
        depth: item.depth,
        anchor: ancoraUnica(`sec-${item.node.slug}`),
      };
    }
    const stored = contentByNode.get(item.node.id);
    const { blocks } = normalizeDoc(stored?.content_json);
    const anchor = ancoraUnica(`art-${item.node.slug}`);
    return {
      kind: "article" as const,
      node: item.node,
      depth: item.depth,
      anchor,
      prefix: `${anchor}--`,
      blocks,
      updatedAt: stored?.updated_at ?? item.node.updated_at,
      excerpt: stored?.excerpt ?? null,
    };
  });

  const artigoSections = sections.filter((s) => s.kind === "article");

  // Índice: pastas (nível 2) e artigos (nível 3). Com poucos artigos ainda cabe
  // listar os títulos internos; com muitos, o índice viraria uma parede.
  const detalharTitulos = artigoSections.length <= 12;
  const toc = sections.flatMap((s) =>
    s.kind === "folder"
      ? [{ id: s.anchor, text: s.node.title, level: 2 }]
      : [
          { id: s.anchor, text: s.node.title, level: 3 },
          ...(detalharTitulos
            ? extractToc(s.blocks, s.prefix, 2).map((t) => ({ ...t, level: 3 }))
            : []),
        ],
  );

  const formatarViews = (v: number) =>
    v >= 1000 ? `${(v / 1000).toFixed(1).replace(".", ",")} mil` : String(v);

  const minutes = Math.max(
    1,
    Math.round(artigoSections.reduce((n, s) => n + wordCount(blocksToText(s.blocks)), 0) / 200),
  );

  // Total de visualizações dos artigos desta página (RLS pública já filtra).
  const { data: viewsRows } = artigoSections.length
    ? await db
        .from("article_views")
        .select("views")
        .in("node_id", artigoSections.map((s) => s.node.id))
    : { data: [] as { views: number }[] };
  const totalViews = (viewsRows ?? []).reduce((n, r) => n + r.views, 0);

  // Paginação: o diretório de 1º NÍVEL seguinte/anterior que tenha conteúdo.
  const temArtigo = (n: (typeof tree)[number]): boolean =>
    n.type === "article" || n.children.some(temArtigo);
  const raizes = tree.filter((n) => n.type !== "divider" && n.type !== "link" && temArtigo(n));
  const gi = raizes.findIndex((g) => g.id === groupRoot.id);
  const prevGroup = gi > 0 ? raizes[gi - 1] : null;
  const nextGroup = gi >= 0 && gi < raizes.length - 1 ? raizes[gi + 1] : null;

  const título = groupRoot.title;
  const crumbs = ancestorsOf(tree, groupRoot.id).slice(0, -1);
  const atual = node.type === "article" ? node : (artigos[0] ?? null);

  // Assinaturas: autor público e tags de cada artigo, numa consulta só.
  const bylines = await getArticleBylines(artigos.map((a) => a.id), db);

  // Relacionados: por similaridade com o CONJUNTO da página, cruzando com a
  // árvore efetiva — só aparece o que este espaço realmente enxerga.
  const naPagina = new Set(artigos.map((a) => a.id));
  const relacionados = tema.article.related
    ? (await getRelatedArticles(space.id, artigos.map((a) => a.id), db))
        .map((r) => flattenPortalTree(tree).find((n) => n.id === r.node_id))
        .filter((n): n is NonNullable<typeof n> => !!n && !naPagina.has(n.id))
        .slice(0, 4)
    : [];

  return (
    <PortalShell space={space} tree={tree} activePath={activePath} toc={toc} activeNodeId={atual?.id ?? null}>
      {originSetter}
      {/* `.leitura` + data-size ligam a escala tipográfica do tema (Aparência →
          Leitura). "large" reproduz a escala original via fallbacks. */}
      <article className="leitura mx-auto max-w-prose" data-size={tema.article.fontSize}>
        <Breadcrumbs spaceSlug={spaceSlug} crumbs={crumbs} spaceName={space.name} current={título} />
        <h1 className="text-[length:var(--l-page,1.5rem)] font-bold leading-[1.15] tracking-tight sm:text-[length:calc(var(--l-page,1.5rem)+0.25rem)]">
          {título}
        </h1>
        {/* Metadados como "eyebrow" discreto: informam sem competir com o título. */}
        <div className="mb-6 mt-3 flex items-center gap-2 border-b border-border pb-6 text-[0.8125rem] text-text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5" /> {minutes} min de leitura
          </span>
          <span aria-hidden="true" className="opacity-40">
            ·
          </span>
          <span>
            {artigoSections.length} {artigoSections.length === 1 ? "artigo" : "artigos"}
          </span>
          {totalViews > 0 && (
            <>
              <span aria-hidden="true" className="opacity-40">
                ·
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Eye className="size-3.5" /> {formatarViews(totalViews)}{" "}
                {totalViews === 1 ? "visualização" : "visualizações"}
              </span>
            </>
          )}
        </div>

        <ReadingScroll
          spaceSlug={spaceSlug}
          initialId={atual?.id ?? null}
          articles={artigoSections.map((s) => ({
            id: s.node.id,
            anchor: s.anchor,
            path: s.node.slugPath.join("/"),
          }))}
        />

        {sections.map((s, i) =>
          s.kind === "folder" ? (
            // Cabeçalho da subseção: dá o contexto de onde os próximos artigos
            // vivem. O ESTILO da separação entre diretórios de 1º nível vem do
            // tema (Aparência → Leitura): faixa destacada, linha ou só espaço.
            <section
              key={s.node.id}
              id={s.anchor}
              className={
                s.depth <= 1
                  ? tema.article.divider === "line"
                    ? "mt-20 scroll-mt-20 border-t border-border pt-10 first:mt-12 first:border-0 first:pt-0"
                    : "mt-20 scroll-mt-20 first:mt-12"
                  : "mt-16 scroll-mt-20"
              }
            >
              {s.depth <= 1 && tema.article.divider === "band" ? (
                // Faixa com o fundo suave da marca: título de DIRETÓRIO nunca
                // se confunde com título de conteúdo.
                <div className="rounded-xl bg-brand-purple-50 px-5 py-4 dark:bg-brand-purple-950/30">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-primary">
                    Seção
                  </p>
                  <h2 className="mt-1 text-[length:var(--l-section,var(--text-3xl))] font-semibold leading-tight">
                    {s.node.title}
                  </h2>
                </div>
              ) : (
                <>
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-text-muted">
                    Seção
                  </p>
                  <h2
                    className={
                      s.depth <= 1
                        ? "mt-1.5 text-[length:var(--l-section,var(--text-3xl))] font-semibold leading-tight"
                        : "mt-1.5 text-[length:var(--l-article,var(--text-2xl))] font-semibold leading-tight"
                    }
                  >
                    {s.node.title}
                  </h2>
                </>
              )}
            </section>
          ) : (
            <section
              key={s.node.id}
              id={s.anchor}
              data-article-id={s.node.id}
              className={i > 0 ? "mt-14 scroll-mt-20" : "mt-10 scroll-mt-20"}
            >
              {/* Fronteira entre ARTIGOS consecutivos: linha curta e sutil —
                  sem ela, um artigo "vazava" no outro na leitura contínua. */}
              {i > 0 && sections[i - 1]?.kind === "article" && (
                <hr className="mb-14 w-16 border-border" />
              )}
              <h3 className="text-[length:var(--l-article,var(--text-2xl))] font-semibold leading-tight">
                {s.node.title}
              </h3>
              {(s.updatedAt || bylines.get(s.node.id)?.author) && (
                <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
                  {bylines.get(s.node.id)?.author && (
                    <>
                      <span className="inline-flex items-center gap-1.5">
                        {bylines.get(s.node.id)!.author!.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={bylines.get(s.node.id)!.author!.avatar!}
                            alt=""
                            className="size-4 rounded-full object-cover"
                          />
                        ) : null}
                        <Link
                          href={`/docs/${spaceSlug}?autor=${bylines.get(s.node.id)!.author!.slug}`}
                          className="text-text-muted no-underline hover:text-primary"
                        >
                          {bylines.get(s.node.id)!.author!.name}
                        </Link>
                      </span>
                      {s.updatedAt && (
                        <span aria-hidden="true" className="opacity-40">
                          ·
                        </span>
                      )}
                    </>
                  )}
                  {s.updatedAt && (
                    <span>
                      Atualizado em{" "}
                      <time dateTime={new Date(s.updatedAt).toISOString()}>
                        {new Date(s.updatedAt).toLocaleDateString("pt-BR")}
                      </time>
                    </span>
                  )}
                </p>
              )}
              {(bylines.get(s.node.id)?.tags.length ?? 0) > 0 && (
                <p className="mt-2 flex flex-wrap gap-1.5">
                  {bylines.get(s.node.id)!.tags.map((t) => (
                    <Link
                      key={t.slug}
                      href={`/docs/${spaceSlug}?tag=${t.slug}`}
                      className="rounded-full border border-border px-2 py-0.5 text-[0.6875rem] text-text-muted no-underline transition-colors hover:border-primary hover:text-primary"
                    >
                      {t.name}
                    </Link>
                  ))}
                </p>
              )}
              {/* headingShift=2: o H1 do conteúdo vira H3 — um degrau ABAIXO do
                  título do artigo (H3 visual 24px), nunca acima dele. */}
              <div className="prose prose-neutral prose-portal mt-5 max-w-none dark:prose-invert">
                <RenderBlocks blocks={s.blocks} snippets={snippets} idPrefix={s.prefix} headingShift={2} />
              </div>
              <Feedback nodeId={s.node.id} supportUrl={supportUrl} />
            </section>
          ),
        )}

        {relacionados.length > 0 && (
          <section aria-label="Artigos relacionados" className="mt-20 border-t border-border pt-8">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Artigos relacionados
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {relacionados.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/docs/${spaceSlug}/${r.slugPath.join("/")}`}
                    className="group flex h-full items-center gap-3 rounded-lg border border-border bg-surface p-3.5 no-underline transition-shadow hover:shadow-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium leading-snug">
                        {r.title}
                      </span>
                      {r.slugPath.length > 1 && (
                        <span className="mt-0.5 block truncate text-xs text-text-muted">
                          {ancestorsOf(tree, r.id)
                            .slice(0, -1)
                            .map((c) => c.title)
                            .join(" › ")}
                        </span>
                      )}
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transform-none" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Anterior/Próximo em CARDS (Microsoft Learn): eyebrow + título com
            alvo de clique generoso, no lugar de dois links soltos. */}
        <nav aria-label="Diretórios vizinhos" className="mt-6 grid grid-cols-2 gap-3">
          {prevGroup ? (
            <Link
              href={`/docs/${spaceSlug}/${prevGroup.slugPath.join("/")}`}
              className="group rounded-lg border border-border bg-surface p-4 no-underline shadow-1 transition-all hover:border-brand-purple-300 hover:shadow-2 dark:hover:border-brand-purple-700"
            >
              <span className="block text-[0.6875rem] font-bold uppercase tracking-wider text-brand-gray-400">← Anterior</span>
              <span className="mt-1 block truncate text-sm font-semibold transition-colors group-hover:text-brand-purple-700 dark:group-hover:text-brand-purple-300">
                {prevGroup.title}
              </span>
            </Link>
          ) : (
            <span aria-hidden="true" />
          )}
          {nextGroup ? (
            <Link
              href={`/docs/${spaceSlug}/${nextGroup.slugPath.join("/")}`}
              className="group rounded-lg border border-border bg-surface p-4 text-right no-underline shadow-1 transition-all hover:border-brand-purple-300 hover:shadow-2 dark:hover:border-brand-purple-700"
            >
              <span className="block text-[0.6875rem] font-bold uppercase tracking-wider text-brand-gray-400">Próximo →</span>
              <span className="mt-1 block truncate text-sm font-semibold transition-colors group-hover:text-brand-purple-700 dark:group-hover:text-brand-purple-300">
                {nextGroup.title}
              </span>
            </Link>
          ) : (
            <span aria-hidden="true" />
          )}
        </nav>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "TechArticle",
              headline: atual?.title ?? título,
              dateModified: sections.find((s) => s.node.id === atual?.id)?.updatedAt,
              description:
                sections.find((s) => s.node.id === atual?.id)?.excerpt ?? undefined,
            }),
          }}
        />
      </article>
    </PortalShell>
  );
}
