import { z } from "zod";
import { generateObject } from "ai";
import type { FilePart, ImagePart, TextPart } from "ai";
import { languageModel, aiTimeout, ehTimeout } from "../ai/config";
import { READ_INSTRUCTIONS } from "./prompts";
import type { Extraction } from "./extract";
import type { ProposedNode, ContentItem } from "./tree";
import type { DocInput } from "./doc-input";

/**
 * PASSA A da leitura por IA: a IA lê o documento (via `DocInput`) e devolve um
 * ESBOÇO — pastas/artigos com faixa de páginas. Aqui o esboço vira uma árvore
 * `ProposedNode` com conteúdo (parágrafos + imagens) FATIADO da extração por
 * faixa de página. A Fase B substitui esse conteúdo por blocos ricos.
 *
 * Schema plano (4 níveis) de propósito: é o limite prático da saída estruturada
 * da Anthropic/OpenAI (ver structure.ts). `.nullable()` (não `.optional()`) pelo
 * modo estrito da OpenAI.
 */
const o4 = z.object({
  title: z.string(),
  pageStart: z.number().int(),
  pageEnd: z.number().int(),
});
const o3 = z.object({
  title: z.string(),
  pageStart: z.number().int(),
  pageEnd: z.number().int(),
  children: z.array(o4).nullable(),
});
const o2 = z.object({
  title: z.string(),
  pageStart: z.number().int(),
  pageEnd: z.number().int(),
  children: z.array(o3).nullable(),
});
const o1 = z.object({
  title: z.string(),
  pageStart: z.number().int(),
  pageEnd: z.number().int(),
  children: z.array(o2).nullable(),
});
const outlineSchema = z.object({ nodes: z.array(o1) });

export type OutlineNode = {
  title: string;
  pageStart: number;
  pageEnd: number;
  children?: OutlineNode[] | null;
};

export type ReadOutlineResult = { tree: ProposedNode[] } | { erro: string };

/**
 * Converte o esboço em árvore, atribuindo cada bloco extraído ao nó MAIS
 * PROFUNDO cuja faixa de páginas contém a página do bloco (folha vence pasta).
 * Títulos (level>0) não viram corpo — só parágrafos e imagens.
 */
export function outlineToTree(
  outline: OutlineNode[],
  extraction: Extraction,
): ProposedNode[] {
  const flat: { node: ProposedNode; start: number; end: number; depth: number }[] = [];
  const build = (list: OutlineNode[], depth: number): ProposedNode[] =>
    list.map((o) => {
      const node: ProposedNode = {
        title: (o.title || "Sem título").trim().slice(0, 200),
        content: [],
        children: build(o.children ?? [], depth + 1),
      };
      const start = o.pageStart || 0;
      const end = Math.max(o.pageEnd || 0, start);
      flat.push({ node, start, end: end || Number.MAX_SAFE_INTEGER, depth });
      return node;
    });
  const tree = build(outline, 0);
  if (tree.length === 0) return [];

  const imgByBlock = new Map<number, number[]>();
  extraction.images.forEach((img, i) => {
    const arr = imgByBlock.get(img.afterBlock) ?? [];
    arr.push(i);
    imgByBlock.set(img.afterBlock, arr);
  });

  // Descarta o FRONT MATTER (capa, folha de rosto, SUMÁRIO, preâmbulo genérico)
  // que vive ANTES da primeira seção real. Sem isto, esses blocos — que nenhum
  // nó cobre — cairiam no primeiro artigo e o poluiriam (era o sumário virando
  // texto do primeiro artigo). Cap de segurança: só corta se o começo parece
  // mesmo folha de rosto (nas primeiras páginas), nunca metade do documento.
  const maxPag = extraction.blocks.reduce((m, b) => Math.max(m, b.page ?? 0), 0);
  const inicios = flat.map((f) => f.start).filter((s) => s > 0);
  const primeiroConteudo = inicios.length ? Math.min(...inicios) : 1;
  const cortaFrontMatter =
    primeiroConteudo <= Math.max(6, Math.ceil(maxPag * 0.25)) ? primeiroConteudo : 1;

  const primeiro = flat[0]!.node;
  const imagensColocadas = new Set<number>();
  extraction.blocks.forEach((b, i) => {
    const pag = b.page ?? 1;
    if (pag < cortaFrontMatter) return; // folha de rosto / sumário — não é conteúdo
    // Escolhe o nó dono da página: mais PROFUNDO vence (folha vence pasta) e,
    // no EMPATE de profundidade (faixas irmãs que se sobrepõem), vence a que
    // COMEÇA MAIS TARDE — assim a abertura de um artigo novo não fica presa no
    // artigo anterior (o bug do conteúdo que "vazava" para o de cima).
    let alvo: (typeof flat)[number] | null = null;
    for (const f of flat) {
      if (pag < f.start || pag > f.end) continue;
      if (!alvo || f.depth > alvo.depth || (f.depth === alvo.depth && f.start > alvo.start)) {
        alvo = f;
      }
    }
    const destino = alvo?.node ?? primeiro;
    const items: ContentItem[] = [];
    if (b.text) {
      if (b.level === 0) {
        items.push({ type: "p", text: b.text });
      } else if (b.text.trim().toLowerCase() !== destino.title.trim().toLowerCase()) {
        // PRESERVA os subtítulos DENTRO do artigo — só descarta o heading que
        // apenas repete o título do próprio nó (senão duplicaria). Antes, TODO
        // heading level>0 era jogado fora, e por isso sumiam títulos do corpo.
        items.push({ type: "h", level: Math.min(b.level, 3), text: b.text });
      }
    }
    for (const k of imgByBlock.get(i) ?? []) {
      items.push({ type: "img", image: k });
      imagensColocadas.add(k);
    }
    destino.content.push(...items);
  });

  // Revisão de completude das imagens: uma imagem cuja âncora (`afterBlock`) caiu
  // no front matter descartado, ou que a extração não conseguiu ancorar
  // (`afterBlock` fora da faixa), não entrou em nenhum artigo. Só as de front
  // matter são ruído de propósito (capa/sumário); as demais não podem sumir —
  // vão para o primeiro artigo, como a rede de [[reinsertImages]] no layout.
  extraction.images.forEach((img, k) => {
    if (imagensColocadas.has(k)) return;
    const ancora = extraction.blocks[img.afterBlock];
    const ehFrontMatter = ancora ? (ancora.page ?? 1) < cortaFrontMatter : false;
    if (!ehFrontMatter) primeiro.content.push({ type: "img", image: k });
  });

  return tree;
}

export async function readOutline(
  docInput: DocInput,
  extraction: Extraction,
): Promise<ReadOutlineResult> {
  const content: Array<TextPart | FilePart | ImagePart> = [
    { type: "text", text: READ_INSTRUCTIONS },
    ...(docInput.parts as Array<TextPart | FilePart | ImagePart>),
  ];

  try {
    const { object } = await generateObject({
      model: await languageModel("import_structure"),
      schema: outlineSchema,
      messages: [{ role: "user", content }],
      abortSignal: aiTimeout("import_structure"),
    });
    const tree = outlineToTree(object.nodes as OutlineNode[], extraction);
    if (tree.length === 0) return { erro: "a IA não devolveu nenhum nó" };
    return { tree };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Leitura de estrutura (Passa A) falhou:", msg);
    if (ehTimeout(e)) return { erro: "a IA não respondeu a tempo" };
    return { erro: msg.slice(0, 300) };
  }
}
