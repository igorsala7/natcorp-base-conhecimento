import { describe, it, expect } from "vitest";
import { flatten, planejarDrop } from "./tree-utils";
import type { TreeNode } from "@/lib/content/tree";

function no(id: string, children: TreeNode[] = []): TreeNode {
  return { id, type: "folder", title: id, position: `p${id}`, children } as unknown as TreeNode;
}
function art(id: string): TreeNode {
  return { id, type: "article", title: id, position: `p${id}`, children: [] as TreeNode[] } as unknown as TreeNode;
}

/** Árvore base:  A[A1,A2]  B  */
function arvore(): TreeNode[] {
  return [no("A", [art("A1"), art("A2")]), no("B")];
}
const ordem = (nodes: TreeNode[]): string[] =>
  flatten(nodes, new Set<string>()).map((f) => `${"·".repeat(f.depth)}${f.id}`);

describe("planejarDrop (drop intuitivo por zona)", () => {
  it("INSIDE de uma pasta → vira PRIMEIRO filho dela", () => {
    const p = planejarDrop(arvore(), "B", "A", "inside")!;
    expect(p).not.toBeNull();
    expect(p.parentId).toBe("A");
    expect(p.prev).toBeNull();
    expect(p.next).toBe("pA1");
    expect(ordem(p.tree)).toEqual(["A", "·B", "·A1", "·A2"]);
  });

  it("BEFORE reordena antes do alvo, mesmo pai", () => {
    const p = planejarDrop(arvore(), "A2", "A1", "before")!;
    expect(p.parentId).toBe("A");
    expect(p.prev).toBeNull();
    expect(p.next).toBe("pA1");
    expect(ordem(p.tree)).toEqual(["A", "·A2", "·A1", "B"]);
  });

  it("AFTER na raiz → irmão depois do alvo (sai da pasta)", () => {
    const p = planejarDrop(arvore(), "A1", "B", "after")!;
    expect(p.parentId).toBeNull();
    expect(p.prev).toBe("pB");
    expect(p.next).toBeNull();
    expect(ordem(p.tree)).toEqual(["A", "·A2", "B", "A1"]);
  });

  it("BEFORE de um item de raiz → irmão na raiz (leva a subárvore junto)", () => {
    const p = planejarDrop(arvore(), "B", "A", "before")!;
    expect(p.parentId).toBeNull();
    expect(p.prev).toBeNull();
    expect(p.next).toBe("pA");
    expect(ordem(p.tree)).toEqual(["B", "A", "·A1", "·A2"]);
  });

  it("drop no PRÓPRIO item → null", () => {
    expect(planejarDrop(arvore(), "A", "A", "before")).toBeNull();
  });

  it("drop DENTRO da própria subárvore → null (inválido)", () => {
    expect(planejarDrop(arvore(), "A", "A1", "inside")).toBeNull();
  });
});
