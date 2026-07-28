/**
 * Ponte IA → blocos de DADOS. A IA é ótima em CSV e em Mermaid, então ela
 * descreve GRÁFICO como `chartType + CSV` e FLUXOGRAMA como sintaxe Mermaid —
 * grammar minúscula (cabe em qualquer provedor) e reaproveita o parser de CSV
 * (Fase B). Aqui converte para os dados ricos dos blocos.
 */
import { parseDelimited, rowsToChart } from "./tabular";
import { newId } from "./schema";
import type {
  ChartData,
  ChartType,
  FlowData,
  FlowEdge,
  FlowNode,
  FlowNodeType,
  MindMapData,
  MindMapNode,
} from "./schema";

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

/**
 * Outline indentado → MindMapData. A IA descreve o MAPA MENTAL como uma lista
 * indentada (a linha de MENOR indentação é a raiz; cada nível de indentação
 * aninha). Aceita `-`/`*`/`•` como marcador. Robusto a indentação irregular:
 * usa uma pilha por nível de indentação. Null se vazio.
 */
export function outlineToMindMap(outline: string): MindMapData | null {
  const itens: { indent: number; label: string }[] = [];
  for (const linha of (outline ?? "").split(/\r?\n/)) {
    if (!linha.trim()) continue;
    const m = /^(\s*)(.*)$/.exec(linha);
    const indent = (m?.[1] ?? "").replace(/\t/g, "  ").length;
    const label = (m?.[2] ?? "").replace(/^[-*•+]\s+/, "").replace(/^[-*•+]/, "").trim();
    if (label) itens.push({ indent, label });
  }
  if (!itens.length) return null;

  const root: MindMapNode = { id: newId(), label: itens[0]!.label, children: [] };
  const pilha: { indent: number; node: MindMapNode }[] = [{ indent: itens[0]!.indent, node: root }];
  for (let i = 1; i < itens.length; i++) {
    const it = itens[i]!;
    while (pilha.length > 1 && pilha[pilha.length - 1]!.indent >= it.indent) pilha.pop();
    const pai = pilha[pilha.length - 1]!.node;
    const node: MindMapNode = { id: newId(), label: it.label, children: [] };
    (pai.children ??= []).push(node);
    pilha.push({ indent: it.indent, node });
  }
  limparVazios(root);
  return { root };
}

/** MindMapData → outline indentado (2 espaços/nível). Para editar/enviar à IA. */
export function mindMapToOutline(root: MindMapNode): string {
  const linhas: string[] = [];
  const walk = (n: MindMapNode, depth: number) => {
    linhas.push("  ".repeat(depth) + n.label);
    (n.children ?? []).forEach((c) => walk(c, depth + 1));
  };
  walk(root, 0);
  return linhas.join("\n");
}

function limparVazios(n: MindMapNode): void {
  if (n.children && n.children.length === 0) delete n.children;
  n.children?.forEach(limparVazios);
}
