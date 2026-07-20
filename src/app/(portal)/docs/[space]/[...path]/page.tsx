import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Clock } from "lucide-react";
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
} from "@/lib/portal/data";
import { RenderBlocks, extractToc } from "@/lib/blocks/render";
import { normalizeDoc } from "@/lib/blocks/convert";
import { blocksToText } from "@/lib/blocks/serialize";
import { PortalShell, Breadcrumbs, spaceChrome } from "@/components/portal/shell";
import { SearchTrigger, AskTrigger } from "@/components/portal/portal-search";
import { PasswordGate } from "@/components/portal/password-gate";
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
  if (access.locked) return <PasswordGate spaceSlug={spaceSlug} spaceName={access.space.name} />;
  const { space, db } = access;

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
  const { supportUrl } = spaceChrome(space);

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
        <Breadcrumbs spaceSlug={spaceSlug} crumbs={ancestorsOf(tree, node.id).slice(0, -1)} spaceName={space.name} />
        <h1 className="mt-3 text-[length:var(--text-4xl)] font-semibold leading-[1.1]">
          {node.title}
        </h1>
        <ul className="mt-8 divide-y divide-border">
          {node.children
            .filter((c) => c.type !== "divider")
            .map((c) => (
              <li key={c.id}>
                <Link
                  href={`/docs/${spaceSlug}/${c.slugPath.join("/")}`}
                  className="-mx-3 block rounded-md px-3 py-3 transition-colors hover:bg-surface-2"
                >
                  {c.title}
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

  const minutes = Math.max(
    1,
    Math.round(artigoSections.reduce((n, s) => n + wordCount(blocksToText(s.blocks)), 0) / 200),
  );

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

  return (
    <PortalShell space={space} tree={tree} activePath={activePath} toc={toc} activeNodeId={atual?.id ?? null}>
      <article className="mx-auto max-w-prose">
        <Breadcrumbs spaceSlug={spaceSlug} crumbs={crumbs} spaceName={space.name} />
        <h1 className="mt-3 text-[length:var(--text-4xl)] font-semibold leading-[1.1]">{título}</h1>
        {/* Metadados como "eyebrow" discreto: informam sem competir com o título. */}
        <div className="mt-3 flex items-center gap-2 text-[0.8125rem] text-text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5" /> {minutes} min de leitura
          </span>
          <span aria-hidden="true" className="opacity-40">
            ·
          </span>
          <span>
            {artigoSections.length} {artigoSections.length === 1 ? "artigo" : "artigos"}
          </span>
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
            // vivem. Separação por ESPAÇO — a régua horizontal só entra na
            // primeira profundidade, onde a virada de assunto é real.
            <section
              key={s.node.id}
              id={s.anchor}
              className={
                s.depth <= 1
                  ? "mt-20 scroll-mt-20 border-t border-border pt-10 first:mt-12 first:border-0 first:pt-0"
                  : "mt-16 scroll-mt-20"
              }
            >
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-text-muted">
                Seção
              </p>
              <h2
                className={
                  s.depth <= 1
                    ? "mt-1.5 text-[length:var(--text-3xl)] font-semibold leading-tight"
                    : "mt-1.5 text-[length:var(--text-2xl)] font-semibold leading-tight"
                }
              >
                {s.node.title}
              </h2>
            </section>
          ) : (
            <section
              key={s.node.id}
              id={s.anchor}
              data-article-id={s.node.id}
              className={i > 0 ? "mt-14 scroll-mt-20" : "mt-10 scroll-mt-20"}
            >
              <h3 className="text-[length:var(--text-2xl)] font-semibold leading-tight">
                {s.node.title}
              </h3>
              {s.updatedAt && (
                <p className="mt-1.5 text-xs text-text-muted">
                  Atualizado em{" "}
                  <time dateTime={new Date(s.updatedAt).toISOString()}>
                    {new Date(s.updatedAt).toLocaleDateString("pt-BR")}
                  </time>
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

        <nav className="mt-20 flex justify-between gap-4 border-t border-border pt-8 text-sm">
          {prevGroup ? (
            <Link
              href={`/docs/${spaceSlug}/${prevGroup.slugPath.join("/")}`}
              className="rounded-sm text-primary underline-offset-4 hover:underline"
            >
              ← {prevGroup.title}
            </Link>
          ) : (
            <span />
          )}
          {nextGroup ? (
            <Link href={`/docs/${spaceSlug}/${nextGroup.slugPath.join("/")}`} className="text-right text-primary hover:underline">
              {nextGroup.title} →
            </Link>
          ) : (
            <span />
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
