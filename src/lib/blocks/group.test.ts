import { describe, it, expect } from "vitest";
import type { Block } from "./schema";
import { groupBlocks } from "./group";

const par = (id: string, t = id): Block => ({ id, type: "paragraph", text: [{ text: t }] }) as Block;
const kids = (b: Block | undefined): Block[] => (b && "children" in b ? (b.children as Block[]) : []);
function comoTipo<T extends Block["type"]>(b: Block | undefined, t: T): Extract<Block, { type: T }> {
  if (!b) throw new Error(`bloco ausente (esperava ${t})`);
  expect(b.type).toBe(t);
  return b as Extract<Block, { type: T }>;
}

describe("groupBlocks", () => {
  it("agrupa 2 parágrafos irmãos em colunas (um por coluna)", () => {
    const r = groupBlocks([par("a"), par("b"), par("c")], ["a", "b"], "container", "G");
    expect(r).not.toBeNull();
    expect(r!.blocks.map((b) => b.id)).toEqual(["G", "c"]);
    const cont = comoTipo(r!.blocks[0], "container");
    expect(cont.data.columns).toBe(2);
    expect(cont.children.map((x) => x.type)).toEqual(["column", "column"]);
    expect(kids(cont.children[0])[0]?.id).toBe("a");
    expect(kids(cont.children[1])[0]?.id).toBe("b");
  });

  it("callout recebe os blocos direto (sem wrapper), com data padrão", () => {
    const r = groupBlocks([par("a"), par("b")], ["a", "b"], "callout", "G")!;
    const cont = comoTipo(r.blocks[0], "callout");
    expect(cont.data.variant).toBe("info");
    expect(cont.children.map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("cardGrid embrulha cada bloco num card e define cols", () => {
    const r = groupBlocks([par("a"), par("b"), par("c")], ["a", "b", "c"], "cardGrid", "G")!;
    const cont = comoTipo(r.blocks[0], "cardGrid");
    expect(cont.data.cols).toBe(3);
    expect(cont.children.every((c) => c.type === "card")).toBe(true);
    expect(kids(cont.children[0])[0]?.id).toBe("a");
  });

  it("mantém a ordem do documento e insere na posição do primeiro selecionado", () => {
    // Seleção fora de ordem e não-adjacente: d e b.
    const r = groupBlocks([par("a"), par("b"), par("c"), par("d")], ["d", "b"], "steps", "G")!;
    expect(r.blocks.map((b) => b.id)).toEqual(["a", "G", "c"]);
    const cont = comoTipo(r.blocks[1], "steps");
    expect(cont.children.map((s) => kids(s)[0]?.id)).toEqual(["b", "d"]);
  });

  it("retorna null com menos de 2 blocos resolvidos", () => {
    expect(groupBlocks([par("a"), par("b")], ["a"], "container")).toBeNull();
    expect(groupBlocks([par("a")], ["a", "z"], "container")).toBeNull();
  });

  it("normaliza para ancestrais de topo quando os pais diferem", () => {
    const cont: Block = {
      id: "cont",
      type: "container",
      data: { columns: 1 },
      children: [{ id: "col", type: "column", children: [par("x")] } as Block],
    } as Block;
    // 'a' na raiz + 'x' aninhado (topo = 'cont') → agrupa a + cont.
    const r = groupBlocks([par("a"), cont], ["a", "x"], "callout", "G")!;
    expect(r.blocks.map((b) => b.id)).toEqual(["G"]);
    expect(kids(r.blocks[0]).map((c) => c.id)).toEqual(["a", "cont"]);
  });

  it("agrupa em LISTA: cada parágrafo vira um item com o texto levantado", () => {
    const r = groupBlocks([par("a", "Um"), par("b", "Dois"), par("c")], ["a", "b"], "bulletList", "G")!;
    expect(r.blocks.map((b) => b.id)).toEqual(["G", "c"]);
    const lista = comoTipo(r.blocks[0], "bulletList");
    expect(lista.children.map((i) => i.type)).toEqual(["listItem", "listItem"]);
    const item0 = comoTipo(lista.children[0], "listItem");
    expect(item0.text).toEqual([{ text: "Um" }]);
    expect(item0.children ?? []).toEqual([]); // texto levantado, sem embrulhar o parágrafo
  });

  it("agrupa em LISTA NUMERADA (orderedList)", () => {
    const r = groupBlocks([par("a"), par("b")], ["a", "b"], "orderedList", "G")!;
    expect(comoTipo(r.blocks[0], "orderedList").children.length).toBe(2);
  });

  it("agrupa em CHECKLIST: um item por bloco, desmarcado, com o texto", () => {
    const r = groupBlocks([par("a", "Fazer"), par("b", "Revisar")], ["a", "b"], "checklist", "G")!;
    const cl = comoTipo(r.blocks[0], "checklist");
    expect(cl.data.items.map((i) => ({ text: i.text, checked: i.checked }))).toEqual([
      { text: [{ text: "Fazer" }], checked: false },
      { text: [{ text: "Revisar" }], checked: false },
    ]);
  });

  it("agrupa em BREADCRUMB: junta os textos numa trilha (› entre eles)", () => {
    const r = groupBlocks([par("a", "Início"), par("b", "Seção"), par("c", "Página")], ["a", "b", "c"], "breadcrumb", "G")!;
    const bc = comoTipo(r.blocks[0], "breadcrumb");
    expect(bc.text).toEqual([
      { text: "Início" },
      { text: " › " },
      { text: "Seção" },
      { text: " › " },
      { text: "Página" },
    ]);
  });

  it("agrupa em TEXTO: junta os parágrafos num só, separados por espaço", () => {
    const r = groupBlocks([par("a", "Olá"), par("b", "mundo")], ["a", "b"], "paragraph", "G")!;
    const p = comoTipo(r.blocks[0], "paragraph");
    expect(p.text).toEqual([{ text: "Olá" }, { text: " " }, { text: "mundo" }]);
  });

  it("agrupa no lugar dentro de um pai que aceita filhos arbitrários (column)", () => {
    const col: Block = { id: "col", type: "column", children: [par("a"), par("b"), par("c")] } as Block;
    const cont: Block = { id: "cont", type: "container", data: { columns: 1 }, children: [col] } as Block;
    const r = groupBlocks([cont], ["a", "b"], "callout", "G")!;
    // A árvore de topo continua com 'cont'; o agrupamento ocorre dentro da coluna.
    const novoCont = comoTipo(r.blocks[0], "container");
    const novaCol = comoTipo(novoCont.children[0], "column");
    expect(novaCol.children.map((b) => b.id)).toEqual(["G", "c"]);
    expect(comoTipo(novaCol.children[0], "callout").children.map((b) => b.id)).toEqual(["a", "b"]);
  });
});
