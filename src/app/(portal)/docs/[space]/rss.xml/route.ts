import { getPortalAccess, getPortalTree, flattenPortalTree } from "@/lib/portal/data";
import { env } from "@/lib/env";

const esc = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/**
 * Feed RSS da documentação: os 20 artigos publicados mais recentes.
 * Só para espaços PÚBLICOS — com senha não há como o agregador autenticar.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ space: string }> },
): Promise<Response> {
  const { space: spaceSlug } = await params;
  const access = await getPortalAccess(spaceSlug);
  if (!access || access.locked) return new Response("Não encontrado.", { status: 404 });
  const { space, db } = access;

  const tree = await getPortalTree(space.id, db);
  const artigos = flattenPortalTree(tree)
    .filter((n) => n.type === "article")
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
    .slice(0, 20);

  const base = env.NEXT_PUBLIC_SITE_URL;
  const itens = artigos
    .map(
      (a) => `    <item>
      <title>${esc(a.title)}</title>
      <link>${base}/docs/${space.slug}/${a.slugPath.join("/")}</link>
      <guid isPermaLink="false">${a.id}</guid>
      <pubDate>${new Date(a.updated_at).toUTCString()}</pubDate>
    </item>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${esc(space.name)}</title>
    <link>${base}/docs/${space.slug}</link>
    <description>${esc(`Novidades da documentação ${space.name}`)}</description>
    <language>pt-BR</language>
${itens}
  </channel>
</rss>`;
  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=900",
    },
  });
}
