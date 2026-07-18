import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Clock } from "lucide-react";
import {
  getPublicSpace,
  getPortalTree,
  resolveByPath,
  findRedirect,
  flattenPortalTree,
  ancestorsOf,
  getPublicArticle,
  getPublicSnippets,
} from "@/lib/portal/data";
import { RenderDoc, extractToc } from "@/components/portal/render";
import { PortalShell, Breadcrumbs } from "@/components/portal/shell";
import { Feedback } from "@/components/portal/feedback";

type Params = { space: string; path: string[] };
type Doc = { type: string; content?: unknown[] };

function wordCount(doc: Doc): number {
  let n = 0;
  const walk = (node: { text?: string; content?: unknown[] }) => {
    if (node.text) n += node.text.trim().split(/\s+/).filter(Boolean).length;
    (node.content as { text?: string; content?: unknown[] }[] | undefined)?.forEach(walk);
  };
  walk(doc);
  return n;
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
  const space = await getPublicSpace(spaceSlug);
  if (!space) notFound();

  const tree = await getPortalTree(space.id);
  const node = resolveByPath(tree, path);

  if (!node) {
    const toNodeId = await findRedirect(space.id, path.join("/"));
    if (toNodeId) {
      const target = flattenPortalTree(tree).find((n) => n.id === toNodeId);
      if (target) {
        permanentRedirect(`/docs/${spaceSlug}/${target.slugPath.join("/")}`);
      }
    }
    notFound();
  }

  const crumbs = ancestorsOf(tree, node.id).slice(0, -1);
  const activePath = path.join("/");

  if (node.type === "folder") {
    return (
      <PortalShell space={space} tree={tree} activePath={activePath}>
        <Breadcrumbs spaceSlug={spaceSlug} crumbs={crumbs} spaceName={space.name} />
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{node.title}</h1>
        <ul className="mt-6 space-y-2">
          {node.children
            .filter((c) => c.type !== "divider")
            .map((c) => (
              <li key={c.id}>
                <Link
                  href={`/docs/${spaceSlug}/${c.slugPath.join("/")}`}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {c.title}
                </Link>
              </li>
            ))}
        </ul>
      </PortalShell>
    );
  }

  const article = await getPublicArticle(node.id);
  const doc = (article?.content_json as Doc) ?? { type: "doc", content: [] };
  const snippets = await getPublicSnippets(space.id);
  const toc = extractToc(doc);
  const minutes = Math.max(1, Math.round(wordCount(doc) / 200));

  const articles = flattenPortalTree(tree).filter((n) => n.type === "article");
  const idx = articles.findIndex((n) => n.id === node.id);
  const prev = idx > 0 ? articles[idx - 1] : null;
  const next = idx >= 0 && idx < articles.length - 1 ? articles[idx + 1] : null;

  return (
    <PortalShell space={space} tree={tree} activePath={activePath} toc={toc}>
      <article className="mx-auto max-w-prose">
        <Breadcrumbs spaceSlug={spaceSlug} crumbs={crumbs} spaceName={space.name} />
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{node.title}</h1>
        <div className="mt-2 flex items-center gap-3 text-sm text-text-muted">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-4" /> {minutes} min de leitura
          </span>
          {article?.updated_at && (
            <span>
              Atualizado em {new Date(article.updated_at).toLocaleDateString("pt-BR")}
            </span>
          )}
        </div>

        <div className="prose prose-neutral mt-6 max-w-none dark:prose-invert">
          <RenderDoc doc={doc} snippets={snippets} />
        </div>

        <Feedback nodeId={node.id} />

        <nav className="mt-8 flex justify-between gap-4 border-t border-border pt-6 text-sm">
          {prev ? (
            <Link href={`/docs/${spaceSlug}/${prev.slugPath.join("/")}`} className="text-primary hover:underline">
              ← {prev.title}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={`/docs/${spaceSlug}/${next.slugPath.join("/")}`} className="text-right text-primary hover:underline">
              {next.title} →
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
              headline: node.title,
              dateModified: article?.updated_at,
              description: article?.excerpt ?? undefined,
            }),
          }}
        />
      </article>
    </PortalShell>
  );
}
