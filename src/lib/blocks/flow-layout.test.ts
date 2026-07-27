import { describe, it, expect } from "vitest";
import { layoutFlow, edgePath } from "./flow-layout";
import type { FlowData } from "./schema";

const fluxo: FlowData = {
  nodes: [
    { id: "n1", type: "start", label: "Início" },
    { id: "n2", type: "process", label: "Fazer" },
    { id: "n3", type: "decision", label: "OK?" },
    { id: "n4", type: "end", label: "Fim" },
  ],
  edges: [
    { id: "e1", from: "n1", to: "n2" },
    { id: "e2", from: "n2", to: "n3" },
    { id: "e3", from: "n3", to: "n4", label: "Sim" },
    { id: "e4", from: "n3", to: "n2", label: "Não" }, // aresta de retorno
  ],
};

describe("layoutFlow", () => {
  it("posiciona todos os nós em camadas (ranks) crescentes", () => {
    const l = layoutFlow(fluxo);
    expect(l.nodes).toHaveLength(4);
    const y = Object.fromEntries(l.nodes.map((p) => [p.node.id, p.y]));
    expect(y.n1).toBeLessThan(y.n2!);
    expect(y.n2).toBeLessThan(y.n3!);
    expect(y.n3).toBeLessThan(y.n4!);
    expect(l.width).toBeGreaterThan(0);
    expect(l.height).toBeGreaterThan(0);
  });

  it("gera endpoints por aresta (menos self-loops) sem travar em ciclo", () => {
    const l = layoutFlow(fluxo);
    expect(l.edges).toHaveLength(4);
    for (const e of l.edges) expect(Number.isFinite(e.x1) && Number.isFinite(e.y2)).toBe(true);
  });

  it("nó ARRASTADO (x,y) fica fixo naquela posição", () => {
    const comPin: FlowData = {
      nodes: fluxo.nodes.map((n) => (n.id === "n2" ? { ...n, x: 500, y: 500 } : n)),
      edges: fluxo.edges,
    };
    const l = layoutFlow(comPin);
    const n2 = l.nodes.find((p) => p.node.id === "n2")!;
    expect(n2.x).toBe(500);
    expect(n2.y).toBe(500);
  });

  it("vazio → layout vazio", () => {
    expect(layoutFlow({ nodes: [], edges: [] })).toEqual({
      nodes: [],
      edges: [],
      width: 0,
      height: 0,
    });
  });
});

describe("edgePath", () => {
  it("cada formato produz um path começando em M", () => {
    for (const s of ["bezier", "straight", "step", "arc"] as const) {
      expect(edgePath(0, 0, 100, 100, s).startsWith("M ")).toBe(true);
    }
  });
});
