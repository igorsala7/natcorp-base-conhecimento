/**
 * Embed Engine universal (isomórfico). Detecta o provedor a partir de uma URL
 * colada e devolve os dados para render de um iframe seguro.
 *
 * `detectEmbed(url)` → { provider, url, embedUrl?, ... }. O render usa
 * `embedIframe(data)` para obter src + proporção; qualquer HTML cru (provider
 * "raw") é sanitizado na camada de render (DOMPurify), nunca aqui.
 */
import type { EmbedData, EmbedProvider } from "./schema";

type Rule = {
  provider: EmbedProvider;
  test: RegExp;
  embed: (m: RegExpMatchArray, url: string) => string | undefined;
};

const RULES: Rule[] = [
  {
    provider: "youtube",
    test: /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/,
    embed: (m) => `https://www.youtube.com/embed/${m[1]}`,
  },
  {
    provider: "vimeo",
    test: /vimeo\.com\/(?:video\/)?(\d+)/,
    embed: (m) => `https://player.vimeo.com/video/${m[1]}`,
  },
  {
    provider: "loom",
    test: /loom\.com\/(?:share|embed)\/([\w-]+)/,
    embed: (m) => `https://www.loom.com/embed/${m[1]}`,
  },
  {
    provider: "figma",
    test: /figma\.com\/(?:file|design|proto|board)\//,
    embed: (_m, url) =>
      `https://www.figma.com/embed?embed_host=natcorp&url=${encodeURIComponent(url)}`,
  },
  {
    provider: "googlemaps",
    test: /(?:google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps)/,
    embed: (_m, url) => `https://maps.google.com/maps?q=${encodeURIComponent(url)}&output=embed`,
  },
  {
    provider: "twitter",
    test: /(?:twitter|x)\.com\/[\w]+\/status\/(\d+)/,
    embed: () => undefined, // renderizado via blockquote + widgets
  },
  {
    provider: "gist",
    test: /gist\.github\.com\/[\w-]+\/[0-9a-f]+/,
    embed: (_m, url) => `${url.replace(/#.*$/, "")}.pibb`, // render simples via iframe do gist
  },
  {
    provider: "pdf",
    test: /\.pdf(?:[?#].*)?$/i,
    embed: (_m, url) => url,
  },
];

/** Detecta o provedor de embed de uma URL. Fallback: card de link. */
export function detectEmbed(url: string): EmbedData {
  const clean = url.trim();
  for (const rule of RULES) {
    const m = clean.match(rule.test);
    if (m) {
      const embedUrl = rule.embed(m, clean);
      return embedUrl
        ? { provider: rule.provider, url: clean, embedUrl }
        : { provider: rule.provider, url: clean };
    }
  }
  // HTML cru colado (um <iframe …>) → provider "raw"
  if (/^<(iframe|blockquote|script|embed)\b/i.test(clean)) {
    return { provider: "raw", url: "", html: clean };
  }
  return { provider: "link", url: clean };
}

/** Proporção (aspect-ratio) padrão por provedor, para o wrapper responsivo. */
export function embedAspect(provider: EmbedProvider): string {
  switch (provider) {
    case "youtube":
    case "vimeo":
    case "loom":
      return "16 / 9";
    case "figma":
    case "googlemaps":
    case "pdf":
      return "4 / 3";
    default:
      return "16 / 9";
  }
}

/** Props do iframe para um embed com `embedUrl`. Retorna null se não for iframe. */
export function embedIframe(
  data: EmbedData,
): { src: string; aspect: string; title: string } | null {
  if (!data.embedUrl) return null;
  return {
    src: data.embedUrl,
    aspect: embedAspect(data.provider),
    title: data.title || data.provider,
  };
}

export const EMBED_LABELS: Record<EmbedProvider, string> = {
  youtube: "YouTube",
  vimeo: "Vimeo",
  loom: "Loom",
  figma: "Figma",
  googlemaps: "Google Maps",
  twitter: "Twitter / X",
  gist: "GitHub Gist",
  pdf: "PDF",
  link: "Link",
  raw: "Embed HTML",
};
