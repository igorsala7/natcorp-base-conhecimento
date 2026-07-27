import type { MetadataRoute } from "next";

/**
 * Sistema NÃO indexável: bloqueia TODOS os robôs de busca (Google, Bing, etc.)
 * em todo o site. Reforçado pela meta `robots: noindex` (layout raiz) e pelo
 * cabeçalho `X-Robots-Tag: noindex, nofollow` (next.config) — três camadas.
 * NÃO anuncia o sitemap de propósito.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
