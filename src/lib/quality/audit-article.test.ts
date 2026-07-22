import { describe, it, expect } from "vitest";
import { auditArticle, caminhoInterno, type QualityContext } from "./audit-article";
import type { Block } from "@/lib/blocks/schema";

const ctx = (over?: Partial<QualityContext>): QualityContext => ({
  validPaths: new Set(["global/guia/instalar"]),
  otherArticles: [{ title: "Instalação do agente", path: "global/guia/instalar" }],
  ...over,
});

const p = (id: string, text: string, href?: string): Block => ({
  id,
  type: "paragraph",
  text: [href ? { text, marks: [{ type: "link", href }] } : { text }],
});

describe("caminhoInterno", () => {
  it("normaliza âncora, query e barra final; ignora externos", () => {
    expect(caminhoInterno("/docs/global/a/b#sec?x=1")).toBe("global/a/b");
    expect(caminhoInterno("/docs/global/a/")).toBe("global/a");
    expect(caminhoInterno("https://exemplo.com")).toBeNull();
    expect(caminhoInterno("/admin/conteudo")).toBeNull();
  });
});

describe("auditArticle", () => {
  it("descrição ausente é impacto alto; adequada não gera issue", () => {
    const base = { title: "T", blocks: [] as Block[] };
    const sem = auditArticle({ ...base, description: null }, ctx());
    expect(sem.some((i) => i.tipo === "meta" && i.impacto === "alto")).toBe(true);
    const ok = auditArticle(
      { ...base, description: "Uma descrição com tamanho confortável para aparecer nos cards." },
      ctx(),
    );
    expect(ok.filter((i) => i.tipo === "meta")).toHaveLength(0);
  });

  it("imagem sem alt aponta o bloco", () => {
    const blocks: Block[] = [
      { id: "img1", type: "image", data: { src: "https://x/i.png", alt: "", caption: "" } },
    ];
    const issues = auditArticle({ title: "T", description: "d".repeat(60), blocks }, ctx());
    expect(issues.find((i) => i.tipo === "alt")?.blockId).toBe("img1");
  });

  it("nível de título pulado é detectado; sequência correta não", () => {
    const blocks: Block[] = [
      { id: "h1", type: "heading", text: [{ text: "Um" }], data: { level: 1 } },
      { id: "h3", type: "heading", text: [{ text: "Três" }], data: { level: 3 } },
    ];
    const issues = auditArticle({ title: "T", description: "d".repeat(60), blocks }, ctx());
    expect(issues.find((i) => i.tipo === "heading")?.blockId).toBe("h3");

    const okBlocks: Block[] = [
      { id: "h1", type: "heading", text: [{ text: "Um" }], data: { level: 1 } },
      { id: "h2", type: "heading", text: [{ text: "Dois" }], data: { level: 2 } },
    ];
    const ok = auditArticle({ title: "T", description: "d".repeat(60), blocks: okBlocks }, ctx());
    expect(ok.filter((i) => i.tipo === "heading")).toHaveLength(0);
  });

  it("link interno quebrado é alto; válido passa; dentro de contêiner conta", () => {
    const blocks: Block[] = [
      {
        id: "call",
        type: "callout",
        data: { variant: "info" },
        children: [p("p1", "veja", "/docs/global/nao-existe")],
      },
      p("p2", "ok", "/docs/global/guia/instalar"),
    ];
    const issues = auditArticle({ title: "T", description: "d".repeat(60), blocks }, ctx());
    const quebrados = issues.filter((i) => i.tipo === "link");
    expect(quebrados).toHaveLength(1);
    expect(quebrados[0]?.mensagem).toContain("global/nao-existe");
  });

  it("cita outro artigo sem linkar → sugestão; já linkado → silêncio", () => {
    const semLink = auditArticle(
      {
        title: "T",
        description: "d".repeat(60),
        blocks: [p("p1", "Antes, faça a Instalação do agente na máquina.")],
      },
      ctx(),
    );
    expect(semLink.some((i) => i.tipo === "linkagem")).toBe(true);

    const comLink = auditArticle(
      {
        title: "T",
        description: "d".repeat(60),
        blocks: [
          p("p1", "Antes, faça a Instalação do agente na máquina."),
          p("p2", "link", "/docs/global/guia/instalar"),
        ],
      },
      ctx(),
    );
    expect(comLink.some((i) => i.tipo === "linkagem")).toBe(false);
  });

  it("ordena por impacto: alto antes de médio antes de baixo", () => {
    const blocks: Block[] = [
      { id: "img1", type: "image", data: { src: "https://x/i.png", alt: "", caption: "" } },
      p("p1", "veja", "/docs/global/quebrado"),
    ];
    const issues = auditArticle({ title: "T", description: null, blocks }, ctx());
    const impactos = issues.map((i) => i.impacto);
    expect([...impactos].sort((a, b) => impactos.indexOf(a) - impactos.indexOf(b))).toEqual(impactos);
    expect(impactos[0]).toBe("alto");
  });
});
