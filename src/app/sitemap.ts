import type { MetadataRoute } from "next";
import { createPublicClient } from "@/lib/supabase/public";
import { getPortalTree, flattenPortalTree } from "@/lib/portal/data";
import { env } from "@/lib/env";

// Gerado sob demanda, não no build: o `next build` do Docker não precisa
// alcançar o Supabase, e o sitemap reflete o conteúdo publicado a cada acesso.
export const dynamic = "force-dynamic";

/** Sitemap com todo o conteúdo publicado de espaços públicos. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const supabase = createPublicClient();
  const { data: spaces } = await supabase
    .from("spaces")
    .select("id, slug")
    .eq("visibility", "public");

  const entries: MetadataRoute.Sitemap = [];
  for (const space of spaces ?? []) {
    entries.push({ url: `${base}/docs/${space.slug}`, changeFrequency: "weekly" });
    const tree = await getPortalTree(space.id);
    for (const node of flattenPortalTree(tree)) {
      if (node.type === "divider" || node.type === "link") continue;
      entries.push({
        url: `${base}/docs/${space.slug}/${node.slugPath.join("/")}`,
        lastModified: node.updated_at,
        changeFrequency: "weekly",
      });
    }
  }
  return entries;
}
