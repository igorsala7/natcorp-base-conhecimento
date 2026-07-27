/**
 * Ponte IA → blocos de DADOS. A IA é ótima em CSV e em Mermaid, então ela
 * descreve GRÁFICO como `chartType + CSV` e FLUXOGRAMA como sintaxe Mermaid —
 * grammar minúscula (cabe em qualquer provedor) e reaproveita o parser de CSV
 * (Fase B). Aqui converte para os dados ricos dos blocos.
 */
import { parseDelimited, rowsToChart } from "./tabular";
import type { ChartData, ChartType, FlowData, FlowEdge, FlowNode, FlowNodeType } from "./schema";

/** `chartType` + CSV/TSV → ChartData (X/séries detectados). Null se sem dados. */
export function csvToChartData(
  chartType: ChartType,
  dataCsv: string,
  title?: string,
): ChartData | null {
  const parsed = rowsToChart(parseDelimited(String(dataCsv ?? "")));
  if (!parsed || !parsed.series.length) return null;
  return { chartType, title: title?.trim() || undefined, ...parsed, legend: true, grid: true };
}

// ── Mermaid flowchart → FlowData ────────────────────────────────────────────
const desaspas = (s: string) => s.trim().replace(/^["']|["']$/g, "").trim();

/** Um token `id`, `id[Label]`, `id{Label}`, `id([Label])`, `id[[Label]]`, `id[/Label/]`. */
function parseToken(tok: string): { id: string; type?: FlowNodeType; label?: string } | null {
  const t = tok.trim();
  if (!t) return null;
  let m: RegExpMatchArray | null;
  if ((m = t.match(/^([A-Za-z0-9_]+)\(\[([\s\S]*)\]\)$/)))
    return { id: m[1]!, type: "start", label: desaspas(m[2]!) };
  if ((m = t.match(/^([A-Za-z0-9_]+)\[\[([\s\S]*)\]\]$/)))
    return { id: m[1]!, type: "subroutine", label: desaspas(m[2]!) };
  if ((m = t.match(/^([A-Za-z0-9_]+)\[\/([\s\S]*)\/\]$/)))
    return { id: m[1]!, type: "io", label: desaspas(m[2]!) };
  if ((m = t.match(/^([A-Za-z0-9_]+)\{([\s\S]*)\}$/)))
    return { id: m[1]!, type: "decision", label: desaspas(m[2]!) };
  if ((m = t.match(/^([A-Za-z0-9_]+)\[([\s\S]*)\]$/)))
    return { id: m[1]!, type: "process", label: desaspas(m[2]!) };
  if ((m = t.match(/^([A-Za-z0-9_]+)$/))) return { id: m[1]! };
  return null;
}

/** Separador de aresta: `-->`, `-.->`, `==>` com `|rótulo|` opcional (capturado). */
const SEP = /\s*(?:-{1,2}\.?-?->|==+>)\s*(?:\|([^|]*)\|\s*)?/;

export function mermaidToFlowData(src: string): FlowData {
  const nodes = new Map<string, FlowNode>();
  const edges: FlowEdge[] = [];
  const ensure = (p: { id: string; type?: FlowNodeType; label?: string }) => {
    const ex = nodes.get(p.id);
    if (ex) {
      if (p.label) ex.label = p.label;
      if (p.type && ex.type === "process") ex.type = p.type;
      return ex;
    }
    // "([Fim])" e "([Início])" têm a mesma forma (pílula): decide pelo rótulo.
    let type = p.type ?? "process";
    if (type === "start" && /\b(fim|end|encerr|conclu)\b/i.test(p.label ?? "")) type = "end";
    const n: FlowNode = { id: p.id, type, label: p.label ?? p.id };
    nodes.set(p.id, n);
    return n;
  };

  for (const raw of String(src ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || /^(flowchart|graph|subgraph|end|%%|classDef|class|style|linkStyle)\b/i.test(line))
      continue;
    // Quebra a linha em tokens intercalados por arestas (mantém rótulos).
    const partes = line.split(new RegExp(SEP.source, "g"));
    const toks: { id: string; type?: FlowNodeType; label?: string }[] = [];
    const labels: (string | undefined)[] = [];
    partes.forEach((p, i) => {
      if (i % 2 === 0) {
        const t = parseToken(p);
        if (t) toks.push(t);
        else toks.push({ id: "" });
      } else labels.push(p ? desaspas(p) : undefined);
    });
    // Declaração isolada de nó.
    if (toks.length === 1 && toks[0]!.id) ensure(toks[0]!);
    for (let i = 0; i < toks.length - 1; i++) {
      const a = toks[i]!;
      const b = toks[i + 1]!;
      if (!a.id || !b.id) continue;
      ensure(a);
      ensure(b);
      edges.push({ id: `e${edges.length + 1}`, from: a.id, to: b.id, label: labels[i] || undefined });
    }
  }
  return { nodes: [...nodes.values()], edges };
}
