import { describe, it, expect } from "vitest";
import { csvToChartData, mermaidToFlowData } from "./ai-data-blocks";
import { sanitizeDoc } from "@/lib/importer/rich-blocks";
import { blocksToDoc } from "@/lib/importer/blocks-to-doc";

describe("csvToChartData", () => {
  it("CSV → dados de gráfico com tipo, X e séries", () => {
    const d = csvToChartData("column", "Mês,Vendas,Meta\nJan,120,100\nFev,150,130", "Vendas")!;
    expect(d.chartType).toBe("column");
    expect(d.title).toBe("Vendas");
    expect(d.xKey).toBe("mes");
    expect(d.series.map((s) => s.key)).toEqual(["vendas", "meta"]);
    expect(d.rows).toHaveLength(2);
  });
  it("sem dados → null", () => {
    expect(csvToChartData("line", "")).toBeNull();
  });
});

describe("mermaidToFlowData", () => {
  it("parseia nós, decisão e arestas rotuladas", () => {
    const f = mermaidToFlowData(`flowchart TD
      A([Início]) --> B[Executar]
      B --> C{Deu certo?}
      C -->|Sim| D([Fim])
      C -->|Não| B`);
    const byId = Object.fromEntries(f.nodes.map((n) => [n.id, n]));
    expect(byId.A!.type).toBe("start");
    expect(byId.C!.type).toBe("decision");
    expect(byId.D!.type).toBe("end"); // ([Fim]) vira "end" pelo rótulo
    const rotulos = f.edges.filter((e) => e.from === "C").map((e) => e.label);
    expect(rotulos).toContain("Sim");
    expect(rotulos).toContain("Não");
  });
  it("suporta cadeia A --> B --> C numa linha", () => {
    const f = mermaidToFlowData("flowchart TD\n  A-->B-->C");
    expect(f.nodes.map((n) => n.id).sort()).toEqual(["A", "B", "C"]);
    expect(f.edges).toHaveLength(2);
  });
});

describe("IA → bloco (Melhorar Layout: sanitizeDoc, JSON livre)", () => {
  it("chart com dataCsv vira bloco chart válido", () => {
    const doc = sanitizeDoc({
      blocks: [{ type: "chart", data: { chartType: "bar", dataCsv: "A,B\nx,1\ny,2" } }],
    });
    const b = doc.blocks[0]!;
    expect(b.type).toBe("chart");
    if (b.type === "chart") expect(b.data.series.length).toBeGreaterThan(0);
  });
  it("flow com mermaid vira bloco flow válido", () => {
    const doc = sanitizeDoc({
      blocks: [{ type: "flow", data: { mermaid: "flowchart TD\nA([Início])-->B[Fim]" } }],
    });
    const b = doc.blocks[0]!;
    expect(b.type).toBe("flow");
    if (b.type === "flow") expect(b.data.nodes.length).toBe(2);
  });
});

describe("IA → bloco (Estúdio: blocksToDoc, schema)", () => {
  it("kind chart/flow viram blocos", () => {
    const doc = blocksToDoc([
      { kind: "chart", chartType: "line", dataCsv: "Mês,V\nJan,10\nFev,20", title: null },
      { kind: "flow", mermaid: "flowchart TD\nA-->B" },
    ]);
    expect(doc.blocks.map((b) => b.type)).toEqual(["chart", "flow"]);
  });
});
