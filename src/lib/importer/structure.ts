import { z } from "zod";
import { generateObject } from "ai";
import { chatModel, hasAiKey } from "../ai/config";
import { STRUCTURE_INSTRUCTIONS } from "./prompts";
import type { Extraction } from "./extract";

export type ContentItem =
  | { type: "p"; text: string }
  | { type: "img"; image: number };

export type ProposedNode = {
  title: string;
  content: ContentItem[];
  children: ProposedNode[];
};

/** Detecta nível por numeração "1.2.3" no início do texto. */
function numberingLevel(text: string): number | null {
  const m = text.match(/^(\d+(?:\.\d+){0,3})[.)]?\s+/);
  if (!m || !m[1]) return null;
  return Math.min(m[1].split(".").length, 3);
}

/**
 * Árvore heurística: títulos (por fonte/heading/numeração) criam nós; o corpo
 * acumula sob o título corrente. Imagens entram após o bloco correspondente.
 */
export function heuristicTree(ex: Extraction): ProposedNode[] {
  const root: ProposedNode = { title: "__root__", content: [], children: [] };
  const stack: { level: number; node: ProposedNode }[] = [
    { level: 0, node: root },
  ];

  const imgByBlock = new Map<number, number[]>();
  ex.images.forEach((img, i) => {
    const list = imgByBlock.get(img.afterBlock) ?? [];
    list.push(i);
    imgByBlock.set(img.afterBlock, list);
  });

  const top = () => stack[stack.length - 1]!;

  ex.blocks.forEach((b, i) => {
    const level = b.level || numberingLevel(b.text) || 0;
    if (level > 0) {
      while (stack.length > 1 && top().level >= level) {
        stack.pop();
      }
      const node: ProposedNode = {
        title: b.text.replace(/^\d+(?:\.\d+){0,3}[.)]?\s+/, "").slice(0, 200),
        content: [],
        children: [],
      };
      top().node.children.push(node);
      stack.push({ level, node });
    } else {
      top().node.content.push({ type: "p", text: b.text });
    }
    for (const imgIdx of imgByBlock.get(i) ?? []) {
      top().node.content.push({ type: "img", image: imgIdx });
    }
  });

  // Se tudo virou corpo (nenhum título), cria um único artigo.
  if (root.children.length === 0 && root.content.length > 0) {
    return [{ title: "Documento importado", content: root.content, children: [] }];
  }
  // Corpo antes do primeiro título vira um artigo "Introdução".
  if (root.content.length > 0) {
    root.children.unshift({
      title: "Introdução",
      content: root.content,
      children: [],
    });
  }
  return root.children;
}

/** Achata a árvore em nós com conteúdo + um trecho (para a IA agrupar com contexto). */
type FlatNode = { title: string; content: ContentItem[]; excerpt: string };
function flattenNodes(nodes: ProposedNode[]): FlatNode[] {
  const out: FlatNode[] = [];
  const walk = (list: ProposedNode[]) => {
    for (const n of list) {
      const excerpt = n.content
        .filter((c): c is { type: "p"; text: string } => c.type === "p")
        .map((c) => c.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .slice(0, 240);
      out.push({ title: n.title, content: n.content, excerpt });
      walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

// Schema com profundidade limitada (até 3 níveis). Cada nó referencia um índice
// da lista achatada; `title` opcional permite corrigir a capitalização.
const l3 = z.object({ index: z.number().int(), title: z.string().optional() });
const l2 = z.object({
  index: z.number().int(),
  title: z.string().optional(),
  children: z.array(l3).optional(),
});
const l1 = z.object({
  index: z.number().int(),
  title: z.string().optional(),
  children: z.array(l2).optional(),
});
const refineSchema = z.object({ nodes: z.array(l1) });

type RefNode = { index: number; title?: string; children?: RefNode[] };

/**
 * Refino por LLM (etapa 2 da spec): manda SÓ os títulos indexados (não o
 * conteúdo) e recebe a hierarquia proposta. Reconstrói a árvore preservando o
 * conteúdo de cada seção por índice. Retorna null se a IA não estiver disponível
 * ou falhar (o worker cai na heurística).
 */
export async function refineStructureWithLLM(
  nodes: ProposedNode[],
): Promise<ProposedNode[] | null> {
  if (!hasAiKey()) return null;
  const flat = flattenNodes(nodes);
  if (flat.length === 0) return null;

  try {
    const { object } = await generateObject({
      model: chatModel(),
      prompt:
        STRUCTURE_INSTRUCTIONS +
        "\n\nSEÇÕES (índice, título e trecho):\n" +
        flat
          .map((f, i) => `[${i}] ${f.title}${f.excerpt ? ` — ${f.excerpt}` : ""}`)
          .join("\n"),
      schema: refineSchema,
    });

    const used = new Set<number>();
    const rebuild = (list: RefNode[]): ProposedNode[] =>
      list
        .filter((n) => flat[n.index] && !used.has(n.index))
        .map((n) => {
          used.add(n.index);
          const base = flat[n.index]!;
          return {
            title: (n.title || base.title || "Sem título").slice(0, 200),
            content: base.content,
            children: rebuild(n.children ?? []),
          };
        });

    const tree = rebuild(object.nodes as RefNode[]);
    // Segurança: qualquer seção que a IA tenha esquecido volta no fim (nada se perde).
    flat.forEach((f, i) => {
      if (!used.has(i)) tree.push({ title: f.title, content: f.content, children: [] });
    });
    return tree.length ? tree : null;
  } catch {
    return null;
  }
}
