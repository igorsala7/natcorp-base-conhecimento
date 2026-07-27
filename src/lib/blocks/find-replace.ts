/**
 * Localizar e substituir no documento de blocos (Ctrl+F do editor).
 *
 * Puro e isomórfico. Age no TEXTO RICO (`.text`) dos blocos — parágrafo,
 * título, item de lista, citação. Blocos cujo conteúdo mora em `data`
 * (checklist, tabela) ficam de fora nesta versão. A substituição preserva as
 * marcas (negrito/link…) da span onde o trecho começa.
 */
import type { Block, RichText } from "./schema";

export type FindMatch = { blockId: string; start: number; end: number };

/** Texto rico do bloco, se ele carregar `.text`; senão `null`. */
function textOf(b: Block): RichText | null {
  const t = (b as { text?: RichText }).text;
  return Array.isArray(t) ? t : null;
}

/** Texto puro de um trecho rico (concatena as spans). */
export function richToPlain(rich: RichText): string {
  return rich.map((s) => s.text).join("");
}

function walk(blocks: Block[], fn: (b: Block) => void): void {
  for (const b of blocks) {
    fn(b);
    const ch = "children" in b ? (b.children as Block[] | undefined) : undefined;
    if (ch) walk(ch, fn);
  }
}

function mapTree(blocks: Block[], fn: (b: Block) => Block): Block[] {
  return blocks.map((b) => {
    const nb = fn(b);
    const ch = "children" in nb ? (nb.children as Block[] | undefined) : undefined;
    return ch ? ({ ...nb, children: mapTree(ch, fn) } as Block) : nb;
  });
}

/** Posições (start,end) de todas as ocorrências de `q` no texto puro. */
function ocorrencias(plain: string, q: string, caseSensitive: boolean): [number, number][] {
  if (!q) return [];
  const hay = caseSensitive ? plain : plain.toLowerCase();
  const needle = caseSensitive ? q : q.toLowerCase();
  const out: [number, number][] = [];
  let i = hay.indexOf(needle);
  while (i !== -1) {
    out.push([i, i + q.length]);
    i = hay.indexOf(needle, i + Math.max(1, q.length));
  }
  return out;
}

/** Todas as ocorrências de `query` no documento, em ordem de leitura. */
export function findMatches(blocks: Block[], query: string, caseSensitive = false): FindMatch[] {
  if (!query) return [];
  const matches: FindMatch[] = [];
  walk(blocks, (b) => {
    const rich = textOf(b);
    if (!rich) return;
    for (const [s, e] of ocorrencias(richToPlain(rich), query, caseSensitive)) {
      matches.push({ blockId: b.id, start: s, end: e });
    }
  });
  return matches;
}

/**
 * Substitui o intervalo [start,end) do texto puro por `replacement`, mantendo
 * as marcas da span onde o trecho COMEÇA. Spans totalmente dentro são
 * descartadas; prefixo/sufixo das spans de borda são preservados com suas marcas.
 */
export function replaceRange(rich: RichText, start: number, end: number, replacement: string): RichText {
  const out: RichText = [];
  let off = 0;
  let inseriu = false;
  for (const span of rich) {
    const s0 = off;
    const s1 = off + span.text.length;
    off = s1;
    const comMarcas = (text: string) => (span.marks ? { text, marks: span.marks } : { text });
    if (s1 <= start || s0 >= end) {
      out.push(span); // fora do intervalo
      continue;
    }
    const prefixLen = Math.max(0, start - s0);
    const suffixStart = Math.max(0, end - s0);
    if (prefixLen > 0) out.push(comMarcas(span.text.slice(0, prefixLen)));
    if (!inseriu) {
      out.push(comMarcas(replacement));
      inseriu = true;
    }
    if (suffixStart < span.text.length) out.push(comMarcas(span.text.slice(suffixStart)));
  }
  return out.filter((s) => s.text.length > 0);
}

/** Substitui UMA ocorrência (a informada por `match`). */
export function replaceOne(blocks: Block[], match: FindMatch, replacement: string): Block[] {
  return mapTree(blocks, (b) => {
    if (b.id !== match.blockId) return b;
    const rich = textOf(b);
    if (!rich) return b;
    return { ...b, text: replaceRange(rich, match.start, match.end, replacement) } as Block;
  });
}

/** Substitui TODAS as ocorrências no documento. Devolve a árvore nova e a contagem. */
export function replaceAll(
  blocks: Block[],
  query: string,
  replacement: string,
  caseSensitive = false,
): { blocks: Block[]; count: number } {
  if (!query) return { blocks, count: 0 };
  let count = 0;
  const out = mapTree(blocks, (b) => {
    const rich = textOf(b);
    if (!rich) return b;
    const ms = ocorrencias(richToPlain(rich), query, caseSensitive);
    if (!ms.length) return b;
    count += ms.length;
    let rt = rich;
    // De trás para frente: cada substituição não invalida as posições anteriores.
    for (let k = ms.length - 1; k >= 0; k--) {
      rt = replaceRange(rt, ms[k]![0], ms[k]![1], replacement);
    }
    return { ...b, text: rt } as Block;
  });
  return { blocks: out, count };
}
