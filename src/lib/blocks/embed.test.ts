import { describe, it, expect } from "vitest";
import { detectEmbed } from "./embed";

describe("detectEmbed", () => {
  const cases: [string, string, string | undefined][] = [
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "youtube", "https://www.youtube.com/embed/dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ", "youtube", "https://www.youtube.com/embed/dQw4w9WgXcQ"],
    ["https://vimeo.com/123456789", "vimeo", "https://player.vimeo.com/video/123456789"],
    ["https://www.loom.com/share/abcdef123456", "loom", "https://www.loom.com/embed/abcdef123456"],
    ["https://www.figma.com/design/AbC/My-File", "figma", undefined],
    ["https://www.google.com/maps/place/Paulista", "googlemaps", undefined],
    ["https://twitter.com/user/status/123", "twitter", undefined],
    ["https://x.com/user/status/456", "twitter", undefined],
    ["https://gist.github.com/user/0123456789abcdef", "gist", undefined],
    ["https://files.example.com/manual.pdf", "pdf", undefined],
    ["https://example.com/algo", "link", undefined],
  ];

  it.each(cases)("%s → %s", (url, provider, embedUrl) => {
    const r = detectEmbed(url);
    expect(r.provider).toBe(provider);
    if (embedUrl) expect(r.embedUrl).toBe(embedUrl);
  });

  it("figma e maps geram embedUrl com a URL codificada", () => {
    expect(detectEmbed("https://www.figma.com/design/AbC/File").embedUrl).toContain("figma.com/embed");
    expect(detectEmbed("https://www.google.com/maps/place/X").embedUrl).toContain("output=embed");
  });

  it("HTML de iframe colado vira provider raw", () => {
    const r = detectEmbed('<iframe src="https://x"></iframe>');
    expect(r.provider).toBe("raw");
    expect(r.html).toContain("iframe");
  });
});
