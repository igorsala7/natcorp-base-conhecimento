import { describe, it, expect } from "vitest";
import { blocksToEmailHtml, injectEmailBody, wrapEmailDocument } from "./email-html";
import type { Block } from "./schema";

describe("blocksToEmailHtml", () => {
  it("heading e parágrafo viram HTML com estilo inline", () => {
    const html = blocksToEmailHtml([
      { id: "1", type: "heading", text: [{ text: "Oi" }], data: { level: 1 } },
      { id: "2", type: "paragraph", text: [{ text: "corpo" }] },
    ] as Block[]);
    expect(html).toContain("Oi");
    expect(html).toContain("corpo");
    expect(html).toContain("style=");
  });

  it("botão vira tabela bulletproof com o href e o rótulo", () => {
    const html = blocksToEmailHtml([
      { id: "1", type: "button", data: { label: "Entrar", href: "https://x.com", variant: "primary" } },
    ] as Block[]);
    expect(html).toContain("<table");
    expect(html).toContain("https://x.com");
    expect(html).toContain("Entrar");
  });

  it("escapa HTML do texto (sem XSS)", () => {
    const html = blocksToEmailHtml([
      { id: "1", type: "paragraph", text: [{ text: "<script>alert(1)</script>" }] },
    ] as Block[]);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("negrito e link viram <strong>/<a> com cor de marca", () => {
    const html = blocksToEmailHtml([
      {
        id: "1",
        type: "paragraph",
        text: [
          { text: "veja ", marks: [{ type: "bold" }] },
          { text: "aqui", marks: [{ type: "link", href: "https://x.com" }] },
        ],
      },
    ] as Block[]);
    expect(html).toContain("<strong>");
    expect(html).toContain('href="https://x.com"');
  });

  it("video/embed viram link; mermaid/snippet somem", () => {
    expect(
      blocksToEmailHtml([{ id: "1", type: "video", data: { provider: "youtube", url: "https://y.com" } }] as Block[]),
    ).toContain("https://y.com");
    expect(blocksToEmailHtml([{ id: "1", type: "mermaid", data: { code: "x" } }] as Block[])).toBe("");
  });
});

describe("injectEmailBody", () => {
  const inner = blocksToEmailHtml([
    { id: "1", type: "paragraph", text: [{ text: "{{remetente}}" }] },
    { id: "2", type: "paragraph", text: [{ text: "{{conteudo}}" }] },
    { id: "3", type: "paragraph", text: [{ text: "© {{ano}}" }] },
  ] as Block[]);

  it("troca {{conteudo}} pelo corpo e resolve {{remetente}}/{{ano}}", () => {
    const out = injectEmailBody(inner, "<p>CORPO</p>", { remetente: "Acme", ano: "2026" });
    expect(out).toContain("Acme");
    expect(out).toContain("2026");
    expect(out).toContain("<p>CORPO</p>");
    // Nenhum token cru sobra e o parágrafo-âncora foi trocado inteiro.
    expect(out).not.toMatch(/\{\{\s*conteudo\s*\}\}/);
  });

  it("template sem o token injeta o corpo ao fim (nunca engole o conteúdo)", () => {
    const semToken = blocksToEmailHtml([{ id: "1", type: "paragraph", text: [{ text: "Cabeçalho" }] }] as Block[]);
    const out = injectEmailBody(semToken, "<p>CORPO</p>", { remetente: "Acme", ano: "2026" });
    expect(out).toContain("Cabeçalho");
    expect(out.indexOf("Cabeçalho")).toBeLessThan(out.indexOf("CORPO"));
  });
});

describe("wrapEmailDocument", () => {
  it("gera um documento de e-mail completo, centrado", () => {
    const doc = wrapEmailDocument("<p>x</p>");
    expect(doc).toContain("<!doctype html>");
    expect(doc).toContain("<table");
    expect(doc).toContain("<p>x</p>");
  });
});
