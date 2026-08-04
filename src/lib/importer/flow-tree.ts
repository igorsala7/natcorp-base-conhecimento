import { newId, type Block, type BlockDoc, type FlowData, type FlowNode, type FlowEdge, type FlowNodeType } from "@/lib/blocks/schema";
import type { ProposedNode } from "./tree";
import type { FluxoLido } from "./read-flowchart";

/**
 * Monta a ÁRVORE de importação a partir dos fluxos lidos pela IA: um artigo por fluxo
 * (aba), com título + resumo + PASSO A PASSO + o FLUXOGRAMA redesenhado no bloco `flow`
 * (layout automático). Vários fluxos → um diretório os agrupa.
 */
const rt = (s: string) => [{ text: String(s ?? "") }];
const TIPOS: ReadonlySet<FlowNodeType> = new Set(["start", "end", "process", "decision", "io", "subroutine"]);

export function montarArvoreFluxos(fluxos: FluxoLido[], tituloRaiz: string): ProposedNode[] {
  const artigos = fluxos.map(fluxoParaArtigo).filter((a): a is ProposedNode => a != null);
  if (!artigos.length) return [];
  if (artigos.length === 1) return artigos; // um fluxo só → artigo solto
  return [{ title: (tituloRaiz || "Fluxos de Processo").slice(0, 200), content: [], children: artigos }];
}

function fluxoParaArtigo(f: FluxoLido): ProposedNode | null {
  const titulo = (f.titulo || "Fluxo").trim().slice(0, 200);
  const blocks: Block[] = [{ id: newId(), type: "heading", text: rt(titulo), data: { level: 1 } }];
  if (f.resumo?.trim()) blocks.push({ id: newId(), type: "paragraph", text: rt(f.resumo.trim()) });

  const rotulo = new Map(f.nodes.map((n) => [n.id, n.label]));
  const explic = new Map((f.passos ?? []).map((p) => [p.node, p.explicacao]));
  const ordem = ordenarNos(f);
  if (ordem.length) {
    blocks.push({ id: newId(), type: "heading", text: rt("Passo a passo"), data: { level: 2 } });
    ordem.forEach((nid, i) => {
      const lbl = (rotulo.get(nid) || nid).trim();
      const ex = (explic.get(nid) || "").trim();
      blocks.push({ id: newId(), type: "paragraph", text: rt(`${i + 1}. ${lbl}${ex ? ` — ${ex}` : ""}`) });
    });
  }

  const data = paraFlowData(f);
  if (data.nodes.length) {
    blocks.push({ id: newId(), type: "heading", text: rt("Fluxograma"), data: { level: 2 } });
    blocks.push({ id: newId(), type: "flow", data });
  }
  if (blocks.length <= 1 && !f.resumo?.trim()) return null; // nada aproveitável
  const doc: BlockDoc = { version: 2, blocks };
  return { title: titulo, content: [], children: [], blocks: doc };
}

/** Ordem de leitura do grafo: BFS a partir do início, seguindo as setas; o que não for
 *  alcançado entra ao fim na ordem original. Determinístico (sem depender de layout). */
function ordenarNos(f: FluxoLido): string[] {
  const ids = f.nodes.map((n) => n.id);
  const setIds = new Set(ids);
  const inicio = f.nodes.find((n) => n.type === "start")?.id ?? ids[0];
  const adj = new Map<string, string[]>();
  for (const e of f.edges) { const a = adj.get(e.from) ?? []; a.push(e.to); adj.set(e.from, a); }
  const visto = new Set<string>();
  const out: string[] = [];
  const fila = inicio ? [inicio] : [];
  while (fila.length) {
    const n = fila.shift()!;
    if (visto.has(n) || !setIds.has(n)) continue;
    visto.add(n); out.push(n);
    for (const m of adj.get(n) ?? []) if (!visto.has(m)) fila.push(m);
  }
  for (const id of ids) if (!visto.has(id)) out.push(id);
  return out;
}

/** Grafo lido → FlowData do bloco (valida tipos e descarta arestas com nó inexistente). */
function paraFlowData(f: FluxoLido): FlowData {
  const idsValidos = new Set(f.nodes.map((n) => n.id));
  const nodes: FlowNode[] = f.nodes.map((n) => ({
    id: n.id,
    type: TIPOS.has(n.type as FlowNodeType) ? (n.type as FlowNodeType) : "process",
    label: (n.label || "").slice(0, 200),
  }));
  const edges: FlowEdge[] = f.edges
    .filter((e) => idsValidos.has(e.from) && idsValidos.has(e.to) && e.from !== e.to)
    .map((e, i) => ({ id: `e${i}`, from: e.from, to: e.to, ...(e.label ? { label: String(e.label).slice(0, 80) } : {}) }));
  return { nodes, edges, direction: "TB" };
}
