import { describe, it, expect } from "vitest";
import { resumirProposta } from "./resumo-proposta";
import type { ProposalNode } from "./proposal";

const artigo = (titulo: string, texto?: string): ProposalNode => ({
  tmpId: titulo,
  tipo: "article",
  titulo,
  doc: texto === undefined ? null : ({ blocks: [{ text: texto }] } as never),
  children: [],
});

const pasta = (titulo: string, children: ProposalNode[]): ProposalNode => ({
  tmpId: titulo,
  tipo: "folder",
  titulo,
  doc: null,
  children,
});

describe("resumo da proposta", () => {
  it("conta pastas, artigos e profundidade", () => {
    const r = resumirProposta([
      pasta("Financeiro", [pasta("Faturamento", [artigo("Emitir NF", "conteúdo")]), artigo("Visão geral", "x")]),
      artigo("Solto", "y"),
    ]);
    expect(r.pastas).toBe(2);
    expect(r.artigos).toBe(3);
    expect(r.niveis).toBe(3);
  });

  it("conta o artigo VAZIO — o erro mais fácil de cometer aqui", () => {
    // Materializar um esqueleto de títulos sem corpo: a árvore parece pronta na
    // proposta, e só depois de criada se descobre que está oca.
    const r = resumirProposta([artigo("Escrito", "tem texto"), artigo("Só o título")]);
    expect(r.artigos).toBe(2);
    expect(r.vazios).toBe(1);
  });

  it("bloco existente mas SEM TEXTO ainda conta como vazio", () => {
    // A IA às vezes devolve um documento com um parágrafo em branco; contar o
    // bloco em vez do texto faria o artigo passar por escrito.
    const r = resumirProposta([artigo("Aparência de escrito", "   ")]);
    expect(r.vazios).toBe(1);
  });

  it("a amostra indenta pelo nível, para a forma aparecer sem desenhar a árvore", () => {
    const r = resumirProposta([pasta("Raiz", [artigo("Filho", "x")])]);
    expect(r.amostra[0]).toBe("Raiz");
    expect(r.amostra[1]).toBe("  Filho");
  });

  it("proposta vazia não inventa nível", () => {
    expect(resumirProposta([])).toEqual({ pastas: 0, artigos: 0, vazios: 0, niveis: 0, amostra: [] });
  });
});
