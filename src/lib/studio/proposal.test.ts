import { describe, it, expect } from "vitest";
import {
  aplicarOperacoes,
  aplicarPatch,
  acharNo,
  contarArtigos,
  MAX_ARTIGOS_PROPOSTA,
  type ProposalNode,
  type StudioOp,
} from "./proposal";

const op = (o: Partial<StudioOp>): StudioOp => ({
  op: "criar_no",
  tmpId: "x",
  paiTmpId: null,
  aposTmpId: null,
  tipo: null,
  titulo: null,
  ...o,
});

describe("aplicarOperacoes", () => {
  it("cria pasta com artigo dentro, na ordem", () => {
    const r = aplicarOperacoes(
      [],
      [
        op({ tmpId: "p1", tipo: "folder", titulo: "Guia" }),
        op({ tmpId: "a1", tipo: "article", titulo: "Introdução", paiTmpId: "p1" }),
        op({ tmpId: "a2", tipo: "article", titulo: "Instalação", paiTmpId: "p1" }),
      ],
      ["a1", "a2"],
    );
    expect(r.avisos).toEqual([]);
    expect(r.proposal[0]?.children.map((c) => c.titulo)).toEqual(["Introdução", "Instalação"]);
    expect(r.gerarCorpo).toEqual(["a1", "a2"]);
  });

  it("aposTmpId posiciona entre irmãos", () => {
    const r = aplicarOperacoes(
      [],
      [
        op({ tmpId: "a", tipo: "article", titulo: "A" }),
        op({ tmpId: "c", tipo: "article", titulo: "C" }),
        op({ tmpId: "b", tipo: "article", titulo: "B", aposTmpId: "a" }),
      ],
      [],
    );
    expect(r.proposal.map((n) => n.titulo)).toEqual(["A", "B", "C"]);
  });

  it("tmpId duplicado rejeita; pai desconhecido vai à raiz com aviso", () => {
    const r = aplicarOperacoes(
      [],
      [
        op({ tmpId: "a", tipo: "article", titulo: "A" }),
        op({ tmpId: "a", tipo: "article", titulo: "A de novo" }),
        op({ tmpId: "b", tipo: "article", titulo: "B", paiTmpId: "nao-existe" }),
      ],
      [],
    );
    expect(r.proposal).toHaveLength(2);
    expect(r.avisos.some((a) => a.includes("duplicado"))).toBe(true);
    expect(r.avisos.some((a) => a.includes("raiz"))).toBe(true);
  });

  it("remover é em cascata e invalida gerarCorpo de descendentes", () => {
    const base = aplicarOperacoes(
      [],
      [
        op({ tmpId: "p", tipo: "folder", titulo: "P" }),
        op({ tmpId: "f", tipo: "article", titulo: "F", paiTmpId: "p" }),
      ],
      [],
    ).proposal;
    const r = aplicarOperacoes(base, [op({ op: "remover", tmpId: "p" })], ["f"]);
    expect(r.proposal).toEqual([]);
    expect(r.gerarCorpo).toEqual([]);
  });

  it("mover para o próprio descendente é bloqueado (ciclo)", () => {
    const base = aplicarOperacoes(
      [],
      [
        op({ tmpId: "p", tipo: "folder", titulo: "P" }),
        op({ tmpId: "sub", tipo: "folder", titulo: "Sub", paiTmpId: "p" }),
      ],
      [],
    ).proposal;
    const r = aplicarOperacoes(
      base,
      [op({ op: "mover", tmpId: "p", paiTmpId: "sub" })],
      [],
    );
    expect(r.avisos.some((a) => a.includes("si mesmo"))).toBe(true);
    expect(acharNo(r.proposal, "p")?.children).toHaveLength(1); // intacto
  });

  it("gerarCorpo descarta folder e inexistente", () => {
    const r = aplicarOperacoes(
      [],
      [op({ tmpId: "p", tipo: "folder", titulo: "P" })],
      ["p", "fantasma"],
    );
    expect(r.gerarCorpo).toEqual([]);
  });

  it("respeita o teto de artigos", () => {
    const muitos: StudioOp[] = Array.from({ length: MAX_ARTIGOS_PROPOSTA + 2 }, (_, i) =>
      op({ tmpId: `a${i}`, tipo: "article", titulo: `A${i}` }),
    );
    const r = aplicarOperacoes([], muitos, []);
    expect(contarArtigos(r.proposal)).toBe(MAX_ARTIGOS_PROPOSTA);
    expect(r.avisos.some((a) => a.includes("Limite"))).toBe(true);
  });
});

describe("aplicarPatch", () => {
  it("titulo e doc mesclam sem tocar o resto (um escritor só)", () => {
    const base: ProposalNode[] = [
      { tmpId: "a", tipo: "article", titulo: "A", doc: null, children: [] },
      { tmpId: "b", tipo: "article", titulo: "B", doc: null, children: [] },
    ];
    const comTitulo = aplicarPatch(base, { kind: "titulo", tmpId: "a", titulo: "A2" });
    expect(comTitulo[0]?.titulo).toBe("A2");
    expect(comTitulo[1]).toEqual(base[1]);
    const doc = { version: 2 as const, blocks: [] };
    const comDoc = aplicarPatch(comTitulo, { kind: "doc", tmpId: "b", doc });
    expect(comDoc[1]?.doc).toBe(doc);
    expect(comDoc[0]?.titulo).toBe("A2");
  });
});
