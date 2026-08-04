import { describe, it, expect } from "vitest";
import { montarArvoreFluxos } from "./flow-tree";
import type { FluxoLido } from "./read-flowchart";

const fluxo = (over: Partial<FluxoLido> = {}): FluxoLido => ({
  titulo: "Fluxo do Ponto",
  resumo: "Do INÍCIO à apuração.",
  nodes: [
    { id: "a", type: "start", label: "INÍCIO" },
    { id: "b", type: "process", label: "Cadastro de Escalas" },
    { id: "c", type: "end", label: "FECHAMENTO" },
  ],
  edges: [
    { from: "a", to: "b", label: null },
    { from: "b", to: "c", label: null },
  ],
  passos: [{ node: "b", explicacao: "cadastra as escalas" }],
  ...over,
});

describe("montarArvoreFluxos", () => {
  it("um fluxo → artigo solto com heading, passo a passo e bloco flow", () => {
    const arv = montarArvoreFluxos([fluxo()], "Fluxo de Processos");
    expect(arv).toHaveLength(1);
    const doc = arv[0]!.blocks!;
    const tipos = doc.blocks.map((b) => b.type);
    expect(tipos).toContain("heading");
    expect(tipos).toContain("flow");
    const flow = doc.blocks.find((b) => b.type === "flow") as { data: { nodes: unknown[]; edges: unknown[] } };
    expect(flow.data.nodes).toHaveLength(3);
    expect(flow.data.edges).toHaveLength(2);
  });

  it("passo a passo segue a ordem do grafo (start → …)", () => {
    const arv = montarArvoreFluxos([fluxo()], "x");
    const paras = arv[0]!.blocks!.blocks.filter((b) => b.type === "paragraph").map((b) => (b as { text: { text: string }[] }).text[0]!.text);
    const passos = paras.filter((t) => /^\d+\./.test(t));
    expect(passos[0]).toContain("INÍCIO");
    expect(passos[passos.length - 1]).toContain("FECHAMENTO");
  });

  it("vários fluxos → um diretório os agrupa", () => {
    const arv = montarArvoreFluxos([fluxo({ titulo: "A" }), fluxo({ titulo: "B" })], "Raiz");
    expect(arv).toHaveLength(1);
    expect(arv[0]!.title).toBe("Raiz");
    expect(arv[0]!.children).toHaveLength(2);
  });

  it("descarta arestas com nó inexistente e auto-loops", () => {
    const arv = montarArvoreFluxos([fluxo({ edges: [{ from: "a", to: "z", label: null }, { from: "b", to: "b", label: null }, { from: "a", to: "b", label: null }] })], "x");
    const flow = arv[0]!.blocks!.blocks.find((b) => b.type === "flow") as { data: { edges: unknown[] } };
    expect(flow.data.edges).toHaveLength(1); // só a→b
  });
});
