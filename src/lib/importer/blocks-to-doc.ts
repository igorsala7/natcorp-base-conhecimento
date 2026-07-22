/**
 * Conversão da SAÍDA da IA de layout (layout-schema) para blocos v2.
 * PURO — sem imports de servidor: é usado pelo improve (server) e pelo chat
 * do editor (client). Mover código de volta para improve.ts quebra o build
 * do cliente (server-only) — já foi mina uma vez.
 */
import { newId, type Block, type BlockDoc, type RichText } from "@/lib/blocks/schema";
import { iconByKey } from "@/lib/blocks/icons";
import type { LeafBlock, LayoutBlock } from "./layout-schema";

function rt(t: string): RichText {
  return t ? [{ text: t }] : [];
}
function para(t: string): Block {
  return { id: newId(), type: "paragraph", text: rt(t) };
}
function nonEmptyChildren(nodes: Block[]): Block[] {
  return nodes.length ? nodes : [para("")];
}

/** Mini-estilo (largura/posição) de table/stats → BlockStyles. */
const LARGURA_MAPA = {
  cheia: "full",
  metade: "half",
  terco: "third",
  "dois-tercos": "twoThirds",
  "tres-quartos": "threeQuarters",
} as const;
const POSICAO_MAPA = { esquerda: "left", centro: "center", direita: "right" } as const;

function miniEstilo(
  largura: keyof typeof LARGURA_MAPA | null,
  posicao: keyof typeof POSICAO_MAPA | null,
): { styles: NonNullable<Block["styles"]> } | undefined {
  const styles: Record<string, string> = {};
  if (largura && LARGURA_MAPA[largura]) styles.width = LARGURA_MAPA[largura];
  // posição só tem efeito com largura restrita (styleClass ignora sem width).
  if (posicao && styles.width && styles.width !== "full") styles.justify = POSICAO_MAPA[posicao];
  return Object.keys(styles).length ? { styles: styles as NonNullable<Block["styles"]> } : undefined;
}

/** Só aceita ícone que exista no catálogo (a IA manda string livre). */
function iconStyles(icon: string | null | undefined): { styles: { icon: string } } | undefined {
  return icon && iconByKey(icon) ? { styles: { icon } } : undefined;
}

function leafToBlock(b: LeafBlock): Block {
  switch (b.kind) {
    case "heading":
      return { id: newId(), type: "heading", data: { level: b.level as 2 | 3 }, text: rt(b.text) };
    case "callout":
      return {
        id: newId(),
        type: "callout",
        data: { variant: b.variant },
        children: [para(b.text)],
        ...iconStyles(b.icon),
      };
    case "divider":
      return { id: newId(), type: "divider" };
    case "paragraph":
      return para(b.text);
    case "steps":
      return {
        id: newId(),
        type: "steps",
        children: b.items.map((t) => ({ id: newId(), type: "step", children: [para(t)] })),
      };
    case "bullets":
      return {
        id: newId(),
        type: "bulletList",
        children: b.items.map((t) => ({ id: newId(), type: "listItem", text: rt(t) })),
      };
    case "code":
      return {
        id: newId(),
        type: "code",
        data: { language: b.language ?? null, code: b.code, ...(b.filename ? { filename: b.filename } : {}) },
      };
    case "checklist":
      return {
        id: newId(),
        type: "checklist",
        data: {
          items: b.items.map((t) => ({ id: newId(), text: rt(t), checked: false })),
        },
      };
    case "stats":
      return {
        id: newId(),
        type: "stats",
        data: {
          items: b.items.map((i) => ({ id: newId(), value: i.value, label: i.label, trend: "" })),
        },
        ...miniEstilo(b.largura, b.posicao),
      };
    case "quote":
      return { id: newId(), type: "quote", text: rt(b.text) };
    case "spacer":
      return { id: newId(), type: "spacer", data: { size: b.size } };
    case "button":
      return {
        id: newId(),
        type: "button",
        data: { label: b.label, href: b.url, variant: "primary" },
      };
    case "table":
      return {
        id: newId(),
        type: "table",
        data: {
          hasHeader: true,
          rows: b.rows.filter((r) => r.length > 0).map((row) => row.map((cell) => rt(cell))),
        },
        ...miniEstilo(b.largura, b.posicao),
      };
  }
}

export function blockToBlock(b: LayoutBlock): Block {
  switch (b.kind) {
    case "panel":
      return {
        id: newId(),
        type: "panel",
        data: { bg: b.bg },
        children: nonEmptyChildren(b.items.map(para)),
        ...iconStyles(b.icon),
      };
    case "columns": {
      const cols = b.columns.length ? b.columns : [[], []];
      // Proporções só valem se houver uma para cada divisão (1..12).
      const ratios =
        b.ratios && b.ratios.length === cols.length
          ? b.ratios.map((r) => Math.min(12, Math.max(1, Math.round(Number(r) || 1))))
          : undefined;
      return {
        id: newId(),
        type: "container",
        data: {
          columns: cols.length,
          ...(ratios ? { ratios } : {}),
          ...(b.divider ? { divider: true } : {}),
        },
        children: cols.map((col) => ({ id: newId(), type: "column", children: nonEmptyChildren(col.map(para)) })),
      };
    }
    case "hero":
      return {
        id: newId(),
        type: "hero",
        data: { eyebrow: b.eyebrow ?? "", title: b.title, subtitle: b.subtitle ?? "", bg: "purple" },
        ...iconStyles(b.icon),
      };
    case "cardGrid":
      return {
        id: newId(),
        type: "cardGrid",
        data: { cols: b.cards.length === 2 || b.cards.length === 4 ? b.cards.length : 3 },
        children: (b.cards.length ? b.cards : [{ title: "", text: "", icon: null }]).map((c) => ({
          id: newId(),
          type: "card",
          data: { icon: c.icon && iconByKey(c.icon) ? c.icon : "book", title: c.title, href: "" },
          children: [para(c.text)],
        })),
      };
    case "accordion":
      return {
        id: newId(),
        type: "accordion",
        children: (b.items.length ? b.items : [{ titulo: "", texto: "" }]).map((item) => ({
          id: newId(),
          type: "accordionItem" as const,
          data: { title: item.titulo },
          // Vários parágrafos por item: divide em linhas em branco.
          children: nonEmptyChildren(
            item.texto.split(/\n{2,}/).filter((t) => t.trim()).map(para),
          ),
        })),
      };
    case "toggle":
      return {
        id: newId(),
        type: "toggle",
        data: { title: b.title },
        children: nonEmptyChildren(b.items.map(para)),
        ...iconStyles(b.icon),
      };
    default:
      return leafToBlock(b as LeafBlock);
  }
}

export function blocksToDoc(blocks: LayoutBlock[]): BlockDoc {
  const out = blocks.map(blockToBlock);
  return { version: 2, blocks: out.length ? out : [para("")] };
}


/**
 * Guarda contra URL alucinada: as guardas de contenção do improve medem
 * original⊂resultado — palavras EXTRAS passam de graça, então um button com
 * URL inventada não seria barrado. Aqui é determinístico: botão cuja URL não
 * consta do texto-base é descartado.
 */
export function filtrarButtonsSemUrl<T extends { kind: string }>(
  blocks: T[],
  textoBase: string,
): T[] {
  return blocks.filter(
    (b) => b.kind !== "button" || textoBase.includes((b as { url?: string }).url ?? ""),
  );
}
