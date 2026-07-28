import { describe, it, expect } from "vitest";
import { outlineToMindMap, mindMapToOutline } from "./ai-data-blocks";
import { layoutMindMap, initialCollapsed, collapsedAllButRoot } from "./mindmap-layout";
import { findNode, mapAddChild, mapAddSibling, mapMove, mapRemove, mapUpdateNode } from "./mindmap-edit";
import type { MindMapData, MindMapNode } from "./schema";

describe("outlineToMindMap", () => {
  it("monta a árvore pela indentação (2 espaços = 1 nível)", () => {
    const d = outlineToMindMap("Tema\n  A\n    A1\n    A2\n  B")!;
    expect(d.root.label).toBe("Tema");
    expect(d.root.children?.map((c) => c.label)).toEqual(["A", "B"]);
    expect(d.root.children?.[0]?.children?.map((c) => c.label)).toEqual(["A1", "A2"]);
    expect(d.root.children?.[1]?.children).toBeUndefined(); // folha sem children
  });

  it("aceita marcadores (- * •) e tabs, ignora linhas vazias", () => {
    const d = outlineToMindMap("- Raiz\n\n\t- Filho\n\t\t* Neto")!;
    expect(d.root.label).toBe("Raiz");
    expect(d.root.children?.[0]?.label).toBe("Filho");
    expect(d.root.children?.[0]?.children?.[0]?.label).toBe("Neto");
  });

  it("indentação irregular não quebra (usa pilha)", () => {
    const d = outlineToMindMap("R\n   A\n      A1\n   B")!;
    expect(d.root.children?.map((c) => c.label)).toEqual(["A", "B"]);
  });

  it("vazio → null", () => {
    expect(outlineToMindMap("")).toBeNull();
    expect(outlineToMindMap("   \n\n")).toBeNull();
  });

  it("ida e volta (outline → árvore → outline) preserva a estrutura", () => {
    const src = "Tema\n  A\n    A1\n  B";
    const d = outlineToMindMap(src)!;
    expect(mindMapToOutline(d.root)).toBe(src);
  });
});

describe("layoutMindMap", () => {
  const data: MindMapData = {
    root: {
      id: "r",
      label: "Raiz",
      children: [
        { id: "a", label: "A", children: [{ id: "a1", label: "A1" }] },
        { id: "b", label: "B" },
      ],
    },
  };

  it("posiciona todos os nós e liga pais a filhos", () => {
    const lay = layoutMindMap(data, new Set());
    expect(lay.nodes.map((n) => n.id).sort()).toEqual(["a", "a1", "b", "r"]);
    // raiz na coluna 0, filhos na 1, neto na 2
    expect(lay.nodes.find((n) => n.id === "r")!.x).toBeLessThan(lay.nodes.find((n) => n.id === "a")!.x);
    expect(lay.nodes.find((n) => n.id === "a")!.x).toBeLessThan(lay.nodes.find((n) => n.id === "a1")!.x);
    expect(lay.edges).toHaveLength(3); // r→a, r→b, a→a1
    expect(lay.width).toBeGreaterThan(0);
  });

  it("nó RETRAÍDO esconde a subárvore", () => {
    const lay = layoutMindMap(data, new Set(["a"]));
    expect(lay.nodes.map((n) => n.id).sort()).toEqual(["a", "b", "r"]); // sem a1
    expect(lay.edges.find((e) => e.to === "a1")).toBeUndefined();
    expect(lay.nodes.find((n) => n.id === "a")!.collapsed).toBe(true);
    expect(lay.nodes.find((n) => n.id === "a")!.hasChildren).toBe(true);
  });

  it("initialCollapsed pega os nós com flag collapsed que têm filhos", () => {
    const d: MindMapData = {
      root: { id: "r", label: "R", collapsed: true, children: [{ id: "x", label: "X", collapsed: true }] },
    };
    // "x" tem collapsed=true mas SEM filhos → não entra
    expect([...initialCollapsed(d.root)]).toEqual(["r"]);
  });
});

describe("mindmap-edit (edição imutável da árvore)", () => {
  const base = (): MindMapNode => ({
    id: "r",
    label: "Raiz",
    children: [
      { id: "a", label: "A", color: "#511C76", children: [{ id: "a1", label: "A1" }] },
      { id: "b", label: "B" },
    ],
  });

  it("mapUpdateNode aplica patch e preserva os demais (imutável)", () => {
    const r0 = base();
    const r1 = mapUpdateNode(r0, "a", { note: "detalhe", icon: "settings" });
    expect(findNode(r1, "a")).toMatchObject({ note: "detalhe", icon: "settings", color: "#511C76" });
    expect(findNode(r1, "b")?.label).toBe("B");
    expect(r0).not.toBe(r1); // não mutou o original
    expect(findNode(r0, "a")?.note).toBeUndefined();
  });

  it("mapAddChild adiciona filho e devolve o id novo", () => {
    const { root, id } = mapAddChild(base(), "b");
    expect(findNode(root, "b")?.children?.map((c) => c.id)).toEqual([id]);
  });

  it("mapAddSibling insere depois; raiz não tem irmão", () => {
    const r = mapAddSibling(base(), "a")!;
    expect(findNode(r.root, "r")?.children?.map((c) => c.id)).toEqual(["a", r.id, "b"]);
    expect(mapAddSibling(base(), "r")).toBeNull();
  });

  it("mapRemove remove o nó; a raiz é intocável", () => {
    expect(findNode(mapRemove(base(), "a1"), "a1")).toBeUndefined();
    expect(findNode(mapRemove(base(), "a"), "a")).toBeUndefined();
    expect(findNode(mapRemove(base(), "r"), "r")).toBeDefined(); // raiz permanece
  });

  it("mapMove troca a ordem entre irmãos (limites não quebram)", () => {
    expect(findNode(mapMove(base(), "b", -1), "r")?.children?.map((c) => c.id)).toEqual(["b", "a"]);
    expect(findNode(mapMove(base(), "a", -1), "r")?.children?.map((c) => c.id)).toEqual(["a", "b"]); // já no topo
  });
});

describe("mindmap: início do leitor + sem sobreposição", () => {
  const data: MindMapData = {
    root: {
      id: "r",
      label: "R",
      children: [
        { id: "a", label: "A", children: [{ id: "a1", label: "A1", children: [{ id: "a1x", label: "x" }] }] },
        { id: "b", label: "B" },
      ],
    },
  };

  it("collapsedAllButRoot retrai tudo menos a raiz", () => {
    const set = collapsedAllButRoot(data.root);
    expect(set.has("r")).toBe(false); // raiz expandida
    expect(set.has("a")).toBe(true); // tem filhos → retraído
    expect(set.has("a1")).toBe(true);
    expect(set.has("b")).toBe(false); // folha
    const lay = layoutMindMap(data, set);
    expect(lay.nodes.map((n) => n.id).sort()).toEqual(["a", "b", "r"]); // só raiz + 1º nível
  });

  it("colunas não se sobrepõem, mesmo com rótulo longo", () => {
    const longo: MindMapData = {
      root: {
        id: "r",
        label: "Raiz",
        children: [
          { id: "a", label: "Um rótulo bem comprido que ocupa muito espaço horizontal", children: [{ id: "a1", label: "filho" }] },
        ],
      },
    };
    const lay = layoutMindMap(longo, new Set());
    const byId = new Map(lay.nodes.map((n) => [n.id, n]));
    for (const e of lay.edges) {
      const p = byId.get(e.from)!;
      const c = byId.get(e.to)!;
      // borda direita do pai ≤ borda esquerda do filho (não invade a coluna)
      expect(p.x + p.w).toBeLessThanOrEqual(c.x);
    }
  });
});
