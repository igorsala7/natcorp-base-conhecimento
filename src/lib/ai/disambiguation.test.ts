import { describe, it, expect } from "vitest";
import type { RetrievedSource } from "./rag";
import { analyzeAmbiguity, analyzeConfidence, resolveTheme } from "./disambiguation";

/** Fonte completa com defaults de artigo; sobrescreva o que o teste precisa. */
function src(p: Partial<RetrievedSource>): RetrievedSource {
  return {
    n: 1,
    node_id: "n",
    document_id: null,
    title: "Título",
    origin: null,
    heading_path: null,
    content: "conteúdo",
    snippet: null,
    url: null,
    image: null,
    space_id: "s1",
    space_name: "Documentação 1",
    dir_node_id: "d1",
    dir_title: "Diretório 1",
    score: 0.05, // confiante por padrão (analyzeAmbiguity ignora; analyzeConfidence usa)
    ...p,
  };
}

describe("analyzeAmbiguity", () => {
  it("um único tema dominante → responde direto (null)", () => {
    const sources = [src({ node_id: "a" }), src({ node_id: "b" }), src({ node_id: "c" })];
    expect(analyzeAmbiguity(sources, null)).toBeNull();
  });

  it("dois diretórios da MESMA documentação → opções por diretório + 'tudo'", () => {
    const sources = [
      src({ node_id: "a", dir_node_id: "d1", dir_title: "Financeiro", space_name: "Sistema" }),
      src({ node_id: "b", dir_node_id: "d2", dir_title: "Estoque", space_name: "Sistema" }),
      src({ node_id: "c", dir_node_id: "d1", dir_title: "Financeiro", space_name: "Sistema" }),
    ];
    const r = analyzeAmbiguity(sources, null);
    expect(r).not.toBeNull();
    const ids = r!.options.map((o) => o.id);
    expect(ids).toEqual(["dir:d1", "dir:d2", "all"]);
    const fin = r!.options.find((o) => o.id === "dir:d1")!;
    // Rótulo = nome do ARTIGO; o diretório e um resumo vão no sublabel.
    expect(fin.label).toBe("Título");
    expect(fin.sublabel).toContain("Financeiro");
    expect(fin.scope).toEqual({ spaceId: "s1", nodeId: "d1" });
    expect(r!.options.at(-1)!.scope).toEqual({ all: true });
  });

  it("remove tags HTML do ts_headline no sublabel (<b>…</b>, &amp;)", () => {
    const sources = [
      src({ node_id: "a", dir_node_id: "d1", dir_title: "RH", snippet: "veja <b>férias</b> &amp; folgas" }),
      src({ node_id: "b", dir_node_id: "d2", dir_title: "Ponto", snippet: "bater <b>ponto</b>" }),
      src({ node_id: "c", dir_node_id: "d1", dir_title: "RH", snippet: "irrelevante" }),
    ];
    const rh = analyzeAmbiguity(sources, null)!.options.find((o) => o.id === "dir:d1")!;
    expect(rh.sublabel).not.toMatch(/<\/?b>/);
    expect(rh.sublabel).not.toContain("&amp;");
    expect(rh.sublabel).toContain("férias & folgas");
  });

  it("duas DOCUMENTAÇÕES → opções por documentação", () => {
    const sources = [
      src({ node_id: "a", space_id: "s1", space_name: "Sistema A", dir_node_id: "d1" }),
      src({ node_id: "b", space_id: "s2", space_name: "Sistema B", dir_node_id: "d2" }),
    ];
    const r = analyzeAmbiguity(sources, null)!;
    const o1 = r.options.find((o) => o.id === "space:s1")!;
    expect(o1.label).toBe("Sistema A");
    expect(o1.scope).toEqual({ spaceId: "s1" });
    expect(r.options.map((o) => o.id)).toContain("space:s2");
  });

  it("ciente do contexto: se o tema em foco está entre os competidores, NÃO pergunta", () => {
    const sources = [
      src({ node_id: "a", dir_node_id: "d1" }),
      src({ node_id: "b", dir_node_id: "d2" }),
    ];
    expect(analyzeAmbiguity(sources, { spaceId: "s1", nodeId: "d1" })).toBeNull();
    // Tema em foco diferente dos competidores → ambíguo (fora do contexto).
    expect(analyzeAmbiguity(sources, { spaceId: "s1", nodeId: "d9" })).not.toBeNull();
  });

  it("contexto 'buscar em tudo' silencia a pergunta", () => {
    const sources = [
      src({ node_id: "a", dir_node_id: "d1" }),
      src({ node_id: "b", dir_node_id: "d2" }),
    ];
    expect(analyzeAmbiguity(sources, { all: true })).toBeNull();
  });

  it("arquivo × artigo competindo → opção de arquivo e de diretório", () => {
    const sources = [
      src({ node_id: "a", dir_node_id: "d1", dir_title: "Financeiro" }),
      src({ node_id: null, document_id: "doc1", title: "Planilha", space_id: null, space_name: null, dir_node_id: null, dir_title: null }),
    ];
    const ids = analyzeAmbiguity(sources, null)!.options.map((o) => o.id);
    expect(ids).toContain("dir:d1");
    expect(ids).toContain("doc:doc1");
  });
});

describe("analyzeConfidence", () => {
  it("recuperação forte (score alto) → responde direto (null)", () => {
    expect(analyzeConfidence([src({ score: 0.05 })], null)).toBeNull();
  });

  it("fonte FORÇADA pela ontologia → confiante, não pergunta", () => {
    expect(analyzeConfidence([src({ score: 0.01, forced: true })], null)).toBeNull();
  });

  it("fraca e CONCENTRADA (≤3 temas) → sugere 'você quis dizer'", () => {
    const sources = [
      src({ node_id: "a", dir_node_id: "d1", dir_title: "Férias", score: 0.015 }),
      src({ node_id: "b", dir_node_id: "d1", dir_title: "Férias", score: 0.014 }),
      src({ node_id: "c", dir_node_id: "d2", dir_title: "Ponto", score: 0.013 }),
    ];
    const r = analyzeConfidence(sources, null)!;
    expect(r).not.toBeNull();
    const ids = r.options.map((o) => o.id);
    expect(ids).toContain("dir:d1");
    expect(ids).toContain("dir:d2");
    expect(ids.at(-1)).toBe("all");
  });

  it("fraca e ESPALHADA (>3 temas) → é ruído, não sugere (null)", () => {
    const sources = [
      src({ node_id: "a", dir_node_id: "d1", score: 0.016 }),
      src({ node_id: "b", dir_node_id: "d2", score: 0.016 }),
      src({ node_id: "c", dir_node_id: "d3", score: 0.015 }),
      src({ node_id: "d", dir_node_id: "d4", score: 0.015 }),
      src({ node_id: "e", dir_node_id: "d5", score: 0.015 }),
    ];
    expect(analyzeConfidence(sources, null)).toBeNull();
  });

  it("contexto 'buscar em tudo' e sem fontes → null", () => {
    expect(analyzeConfidence([src({ score: 0.01 })], { all: true })).toBeNull();
    expect(analyzeConfidence([], null)).toBeNull();
  });
});

describe("resolveTheme", () => {
  it("artigo → escopo de diretório + rótulo do diretório", () => {
    expect(resolveTheme([src({ node_id: "a", space_id: "s1", dir_node_id: "d1", dir_title: "Fin" })])).toEqual({
      scope: { spaceId: "s1", nodeId: "d1" },
      label: "Fin",
    });
  });
  it("arquivo → escopo de documento", () => {
    expect(
      resolveTheme([
        src({ node_id: null, document_id: "doc1", title: "Planilha", space_id: null, dir_node_id: null }),
      ]),
    ).toEqual({ scope: { documentId: "doc1" }, label: "Planilha" });
  });
  it("sem fontes → null", () => {
    expect(resolveTheme([])).toBeNull();
  });
});
