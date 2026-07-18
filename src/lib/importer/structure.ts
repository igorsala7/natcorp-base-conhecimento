import { z } from "zod";
import { generateObject } from "ai";
import { chatModel, hasAiKey } from "../ai/config";
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

/**
 * Refino por LLM (opcional): manda SÓ a lista de títulos candidatos e recebe
 * uma árvore proposta (renomear/reaninhar). Não manda o conteúdo — a spec
 * pede processar a estrutura, não o documento inteiro.
 */
const treeSchema = z.object({
  nodes: z.array(
    z.object({
      title: z.string(),
      children: z.array(z.object({ title: z.string(), children: z.array(z.object({ title: z.string() })).optional() })).optional(),
    }),
  ),
});

export async function refineTitlesWithLLM(
  titles: string[],
): Promise<{ title: string; children?: unknown[] }[] | null> {
  if (!hasAiKey() || titles.length === 0) return null;
  try {
    const { object } = await generateObject({
      model: chatModel(),
      schema: treeSchema,
      prompt:
        "Você recebe uma lista de títulos candidatos extraídos de um documento, na ordem. " +
        "Proponha uma árvore de navegação hierárquica (categorias e subtópicos) reaproveitando os títulos. " +
        "NÃO invente títulos novos nem conteúdo; apenas organize e, se necessário, corrija capitalização.\n\n" +
        titles.map((t, i) => `${i + 1}. ${t}`).join("\n"),
    });
    return object.nodes;
  } catch {
    return null;
  }
}

/** Coleta todos os títulos da árvore heurística (para o refino por LLM). */
export function collectTitles(nodes: ProposedNode[]): string[] {
  const out: string[] = [];
  const walk = (list: ProposedNode[]) => {
    for (const n of list) {
      out.push(n.title);
      walk(n.children);
    }
  };
  walk(nodes);
  return out;
}
