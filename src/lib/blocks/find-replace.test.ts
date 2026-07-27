import { describe, it, expect } from "vitest";
import type { Block, RichText } from "./schema";
import { findMatches, replaceRange, replaceAll, replaceOne, richToPlain } from "./find-replace";

const par = (id: string, ...spans: RichText): Block => ({ id, type: "paragraph", text: spans }) as Block;
const plainOf = (b: Block | undefined): string => richToPlain((b as { text?: RichText }).text ?? []);

describe("find-replace", () => {
  it("encontra ocorrências em vários blocos, na ordem do documento", () => {
    const doc = [par("a", { text: "o rato roeu" }), par("b", { text: "a rato azul" })];
    const m = findMatches(doc, "rato");
    expect(m).toEqual([
      { blockId: "a", start: 2, end: 6 },
      { blockId: "b", start: 2, end: 6 },
    ]);
  });

  it("é case-insensitive por padrão e sensível quando pedido", () => {
    const doc = [par("a", { text: "Rato rato RATO" })];
    expect(findMatches(doc, "rato").length).toBe(3);
    expect(findMatches(doc, "rato", true).length).toBe(1);
  });

  it("busca desce nos filhos (containers)", () => {
    const doc: Block[] = [
      { id: "c", type: "callout", data: { variant: "info" }, children: [par("x", { text: "achou aqui" })] } as Block,
    ];
    expect(findMatches(doc, "achou").map((m) => m.blockId)).toEqual(["x"]);
  });

  it("replaceRange preserva as marcas da span onde começa (dentro de uma span)", () => {
    const rich: RichText = [{ text: "Hello world", marks: [{ type: "bold" }] }];
    const r = replaceRange(rich, 6, 11, "there");
    expect(r).toEqual([
      { text: "Hello ", marks: [{ type: "bold" }] },
      { text: "there", marks: [{ type: "bold" }] },
    ]);
  });

  it("replaceRange atravessa spans e usa as marcas da span inicial", () => {
    const rich: RichText = [{ text: "foo ", marks: [{ type: "bold" }] }, { text: "bar" }];
    // "o bar" (2..7) → "X"
    const r = replaceRange(rich, 2, 7, "X");
    expect(richToPlain(r)).toBe("foX");
    expect(r[1]).toEqual({ text: "X", marks: [{ type: "bold" }] });
  });

  it("replaceAll troca todas as ocorrências e conta", () => {
    const doc = [par("a", { text: "gato gato" }), par("b", { text: "gato" })];
    const { blocks, count } = replaceAll(doc, "gato", "cão");
    expect(count).toBe(3);
    expect(plainOf(blocks[0])).toBe("cão cão");
    expect(plainOf(blocks[1])).toBe("cão");
  });

  it("replaceOne troca só a ocorrência indicada", () => {
    const doc = [par("a", { text: "sol sol" })];
    const out = replaceOne(doc, { blockId: "a", start: 4, end: 7 }, "lua");
    expect(plainOf(out[0])).toBe("sol lua");
  });

  it("query vazia não acha nada e replaceAll é no-op", () => {
    const doc = [par("a", { text: "abc" })];
    expect(findMatches(doc, "")).toEqual([]);
    expect(replaceAll(doc, "", "x").count).toBe(0);
  });
});
