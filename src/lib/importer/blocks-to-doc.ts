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
      return { id: newId(), type: "code", data: { language: b.language ?? null, code: b.code } };
    case "table":
      return {
        id: newId(),
        type: "table",
        data: {
          hasHeader: true,
          rows: b.rows.filter((r) => r.length > 0).map((row) => row.map((cell) => rt(cell))),
        },
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

