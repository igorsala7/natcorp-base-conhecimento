import { z } from "zod";
import { generateObject } from "ai";
import { languageModel, hasAiKey } from "../ai/config";
import { STRUCTURE_INSTRUCTIONS } from "./prompts";
import { tituloLimpo, precisaAgruparComIa, contarNos, profundidade } from "./tree";
import type { ProposedNode, ContentItem } from "./tree";

// Reexporta o núcleo puro para quem já importava daqui.
export { heuristicTree, numberingLevel } from "./tree";
export type { ProposedNode, ContentItem } from "./tree";

/**
 * Achata a árvore preservando a PROFUNDIDADE de cada seção.
 *
 * A versão anterior mandava só a lista de títulos, sem nível — e com isso a IA
 * tinha de reinventar do zero uma hierarquia que o documento JÁ tinha dado
 * (h1–h5 no HTML/DOCX, tamanho de fonte no PDF). O resultado era previsível:
 * "Fases de análise" e "Fases de execução" saíam de dentro de "Fase do chamado"
 * e subiam para "Cadastros"; "Histórico de fases", "Comentários" e "Anexos"
 * viravam raízes soltas. Mandando o nível junto, a tarefa deixa de ser inventar
 * e passa a ser CORRIGIR — que é o que uma passada de LLM faz bem.
 */
type FlatNode = {
  title: string;
  content: ContentItem[];
  excerpt: string;
  depth: number;
  /** Índice do pai na própria lista achatada; -1 = raiz. */
  parent: number;
};
function flattenNodes(nodes: ProposedNode[]): FlatNode[] {
  const out: FlatNode[] = [];
  const walk = (list: ProposedNode[], depth: number, parent: number) => {
    for (const n of list) {
      const excerpt = n.content
        .filter((c): c is { type: "p"; text: string } => c.type === "p")
        .map((c) => c.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .slice(0, 240);
      const eu = out.length;
      out.push({ title: n.title, content: n.content, excerpt, depth, parent });
      walk(n.children, depth + 1, eu);
    }
  };
  walk(nodes, 0, -1);
  return out;
}

/** A lista que a IA recebe: índice, recuo (= nível atual) e um trecho do corpo. */
function listarSecoes(flat: FlatNode[]): string {
  return flat
    .map((f, i) => {
      const recuo = "    ".repeat(f.depth);
      const marca = f.content.length === 0 ? " [sem corpo]" : "";
      return `[${i}] ${recuo}${f.title}${marca}${f.excerpt ? ` — ${f.excerpt}` : ""}`;
    })
    .join("\n");
}

// Schema com profundidade limitada (até 4 níveis). Cada nó referencia um índice
// da lista achatada; `title` permite corrigir a capitalização (null = mantém).
//
// Foram 3 níveis até 2026-07-20, e isso ATRAPALHAVA: a heurística já entrega 4
// (um manual com h1→h4 é banal), então a IA precisava achatar para caber — e
// achatava jogando as netas na raiz. Ao mexer no limite, testar contra a API
// real: a saída estruturada da Anthropic tem teto de gramática.
//
// `.nullable()` e NÃO `.optional()`: o modo estrito da OpenAI exige que toda
// propriedade esteja em `required`. Com `optional`, a API recusava o schema
// inteiro (`invalid_json_schema`) e o refino caía calado na heurística.
const l4 = z.object({ index: z.number().int(), title: z.string().nullable() });
const l3 = z.object({
  index: z.number().int(),
  title: z.string().nullable(),
  children: z.array(l4).nullable(),
});
const l2 = z.object({
  index: z.number().int(),
  title: z.string().nullable(),
  children: z.array(l3).nullable(),
});
const l1 = z.object({
  index: z.number().int(),
  title: z.string().nullable(),
  children: z.array(l2).nullable(),
});
const refineSchema = z.object({ nodes: z.array(l1) });

type RefNode = { index: number; title?: string | null; children?: RefNode[] | null };

/**
 * Refino por LLM (etapa 2 da spec): manda SÓ os títulos indexados (não o
 * conteúdo) e recebe a hierarquia proposta. Reconstrói a árvore preservando o
 * conteúdo de cada seção por índice. A heurística continua sendo o plano B, mas
 * a falha é DEVOLVIDA em `erro` em vez de sumir: um `catch {}` mudo já custou
 * caro aqui — o schema era recusado pela OpenAI e o job registrava apenas "IA
 * indisponível", como se fosse falta de chave.
 */
export type RefineResult = { tree: ProposedNode[] | null; erro?: string };

export async function refineStructureWithLLM(
  nodes: ProposedNode[],
): Promise<RefineResult> {
  if (!(await hasAiKey("import_structure"))) {
    return { tree: null, erro: "nenhuma IA configurada para a finalidade Importação — estrutura" };
  }
  if (!precisaAgruparComIa(nodes)) {
    return {
      tree: null,
      erro:
        `o documento já traz a própria hierarquia (${contarNos(nodes)} seções em ` +
        `${profundidade(nodes)} níveis) e ela foi mantida`,
    };
  }
  const flat = flattenNodes(nodes);
  if (flat.length === 0) return { tree: null };

  try {
    const { object } = await generateObject({
      model: await languageModel("import_structure"),
      prompt:
        STRUCTURE_INSTRUCTIONS +
        "\n\nESTRUTURA ATUAL (índice, recuo = nível, título e trecho):\n" +
        listarSecoes(flat),
      schema: refineSchema,
    });

    const used = new Set<number>();
    const porIndice = new Map<number, ProposedNode>();

    const rebuild = (list: RefNode[]): ProposedNode[] =>
      list
        .filter((n) => flat[n.index] && !used.has(n.index))
        .map((n) => {
          used.add(n.index);
          const base = flat[n.index]!;
          const no: ProposedNode = {
            title: tituloLimpo(base.title || "Sem título", n.title).slice(0, 200),
            content: base.content,
            children: rebuild(n.children ?? []),
          };
          porIndice.set(n.index, no);
          return no;
        });

    const tree = rebuild(object.nodes as RefNode[]);

    // Seção esquecida pela IA volta para o pai que ela tinha NO DOCUMENTO — e
    // não para a raiz. Empilhar tudo na raiz era o que transformava "Histórico
    // de fases", "Comentários" e "Anexos" em três capítulos soltos no fim.
    flat.forEach((f, i) => {
      if (used.has(i)) return;
      const no: ProposedNode = { title: f.title, content: f.content, children: [] };
      const destino = f.parent >= 0 ? porIndice.get(f.parent) : undefined;
      (destino ? destino.children : tree).push(no);
      porIndice.set(i, no);
    });

    return { tree: tree.length ? tree : null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Refino de estrutura falhou:", msg);
    return { tree: null, erro: msg.slice(0, 300) };
  }
}
