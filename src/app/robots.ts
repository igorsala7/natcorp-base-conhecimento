import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  return {
    rules: [
      // O admin nunca deve ser indexado.
      { userAgent: "*", allow: "/docs/", disallow: "/admin/" },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
