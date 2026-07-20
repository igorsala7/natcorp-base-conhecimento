import "server-only";
import { z } from "zod";
import { generateObject } from "ai";
import { chatModel, hasAiKey } from "@/lib/ai/config";
import { LAYOUT_INSTRUCTIONS } from "./prompts";
import { newId, type Block, type BlockDoc, type RichText } from "@/lib/blocks/schema";
import { blocksToText } from "@/lib/blocks/serialize";
import { iconByKey } from "@/lib/blocks/icons";

/**
 * "Melhorar layout" (Fase 4, etapa 4). Um passe de LLM que REFORMATA texto cru
 * em blocos ricos (callout, passo-a-passo, code, listas) — NÃO reescreve,
 * resume ou inventa. O usuário sempre revê o diff antes de aplicar.
 */
// ATENÇÃO: a saída estruturada da Anthropic tem LIMITE DE GRAMÁTICA. Manter o
// schema PLANO — nunca aninhar `discriminatedUnion` dentro de arrays de
// contêiner (painel/colunas usam texto simples). Campos escalares opcionais
// (icon/ratios/divider) são baratos; blocos novos, nem tanto. Ao mexer aqui,
// testar contra a API real antes de commitar.
//
// `icon` é string livre (uma enum com ~75 ícones estouraria a gramática): a
// chave é validada contra o catálogo no conversor e descartada se não existir.
const iconField = z.string().optional();

// Blocos "folha" (não-contêineres). Reaproveitados dentro de painel/colunas.
const leafOptions = [
  z.object({ kind: z.literal("paragraph"), text: z.string() }),
  z.object({ kind: z.literal("heading"), level: z.number().min(2).max(3), text: z.string() }),
  z.object({
    kind: z.literal("callout"),
    variant: z.enum(["info", "warning", "success", "danger"]),
    text: z.string(),
    icon: iconField,
  }),
  z.object({ kind: z.literal("steps"), items: z.array(z.string()) }),
  z.object({ kind: z.literal("bullets"), items: z.array(z.string()) }),
  z.object({
    kind: z.literal("code"),
    language: z.string().optional(),
    code: z.string(),
  }),
  z.object({
    kind: z.literal("table"),
    // primeira linha = cabeçalho; cada linha é um array de células (texto).
    rows: z.array(z.array(z.string())),
  }),
  // Divisória: separa blocos de assunto dentro do artigo.
  z.object({ kind: z.literal("divider") }),
] as const;

type LeafBlock = z.infer<(typeof leafOptions)[number]>;

const blocksSchema = z.object({
  blocks: z.array(
    z.discriminatedUnion("kind", [
      ...leafOptions,
      // Painel = caixa colorida de destaque com parágrafos.
      z.object({
        kind: z.literal("panel"),
        bg: z.enum(["purple", "pink", "blue", "gray"]),
        items: z.array(z.string()),
        icon: iconField,
      }),
      // Região dividida em colunas (cada coluna = parágrafos de texto simples).
      // `ratios` dá a proporção (ex.: [1,2] = estreita à esquerda + larga à
      // direita, ideal para imagem + texto); `divider` desenha a linha entre elas.
      z.object({
        kind: z.literal("columns"),
        columns: z.array(z.array(z.string())),
        ratios: z.array(z.number()).optional(),
        divider: z.boolean().optional(),
      }),
      // Banner/Hero = cabeçalho de destaque (título + subtítulo).
      z.object({
        kind: z.literal("hero"),
        eyebrow: z.string().optional(),
        title: z.string(),
        subtitle: z.string().optional(),
        icon: iconField,
      }),
      // Grade de cards = itens paralelos com título + descrição curta.
      z.object({
        kind: z.literal("cardGrid"),
        cards: z.array(z.object({ title: z.string(), text: z.string(), icon: iconField })),
      }),
      // Toggle = bloco recolhível para conteúdo secundário/opcional.
      z.object({
        kind: z.literal("toggle"),
        title: z.string(),
        items: z.array(z.string()),
        icon: iconField,
      }),
    ]),
  ),
});

type LayoutBlock = z.infer<typeof blocksSchema>["blocks"][number];

// A saída é convertida para o formato de BLOCOS v2 (não mais TipTap).
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
function iconStyles(icon: string | undefined): { styles: { icon: string } } | undefined {
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

function blockToBlock(b: LayoutBlock): Block {
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
        children: (b.cards.length ? b.cards : [{ title: "", text: "" }]).map((c) => ({
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

function blocksToDoc(blocks: LayoutBlock[]): BlockDoc {
  const out = blocks.map(blockToBlock);
  return { version: 2, blocks: out.length ? out : [para("")] };
}

export type ImproveResult =
  | { ok: true; doc: BlockDoc }
  | { ok: false; error: string };

export type ImageRef = { src: string; alt: string; caption: string };

const IMG_TOKEN = "⟦IMG:";
function imgBlock(im: ImageRef): Block {
  return { id: newId(), type: "image", data: { src: im.src, alt: im.alt, caption: im.caption } };
}

/** Remove os marcadores ⟦IMG:n⟧ do texto de um bloco; retorna null se ficar vazio. */
function stripTokens(block: Block): Block | null {
  if (!("text" in block)) return block;
  const text = block.text
    .map((s) => ({ ...s, text: s.text.replace(/⟦IMG:\d+⟧/g, "") }))
    .filter((s) => s.text.length > 0);
  if (!text.map((s) => s.text).join("").trim()) return null;
  return { ...block, text } as Block;
}

/**
 * Re-insere as imagens no lugar dos marcadores ⟦IMG:n⟧ que a IA preservou.
 * Qualquer imagem não colocada vai para o fim — nunca se perde uma imagem.
 */
function reinsertImages(doc: BlockDoc, images: ImageRef[]): BlockDoc {
  const placed = new Set<number>();

  // Recursivo: o marcador pode estar DENTRO de uma coluna/painel — é assim que
  // sai o layout "imagem à esquerda, texto à direita".
  const walk = (list: Block[]): Block[] => {
    const out: Block[] = [];
    for (const block of list) {
      const kids = "children" in block ? block.children : undefined;
      if (kids && kids.length) {
        const nextKids = walk(kids);
        out.push(nextKids === kids ? block : ({ ...block, children: nextKids } as Block));
        continue;
      }
      const text = "text" in block ? blocksToText([block]) : "";
      if (!text.includes(IMG_TOKEN)) {
        out.push(block);
        continue;
      }
      const indices = [...text.matchAll(/⟦IMG:(\d+)⟧/g)].map((m) => Number(m[1]));
      const cleaned = stripTokens(block);
      if (cleaned && blocksToText([cleaned]).trim()) out.push(cleaned);
      for (const i of indices) {
        const im = images[i];
        if (im?.src && !placed.has(i)) {
          placed.add(i);
          out.push(imgBlock(im));
        }
      }
    }
    return out;
  };

  const blocks = walk(doc.blocks);
  // Rede de segurança: imagem que a IA esqueceu volta ao final do artigo.
  images.forEach((im, i) => {
    if (im?.src && !placed.has(i)) blocks.push(imgBlock(im));
  });

  return { version: 2, blocks: blocks.length ? blocks : [para("")] };
}

/** Reformata o texto puro em blocos ricos, preservando as imagens. Exige AI_API_KEY. */
export async function improveLayout(
  plainText: string,
  images: ImageRef[] = [],
): Promise<ImproveResult> {
  if (!await hasAiKey()) {
    return { ok: false, error: "AI_API_KEY não configurada — preencha no .env.local." };
  }
  if (!plainText.trim()) return { ok: false, error: "Sem conteúdo para melhorar." };

  try {
    const { object } = await generateObject({
      model: await chatModel(),
      schema: blocksSchema,
      prompt: LAYOUT_INSTRUCTIONS + "\n\nTEXTO:\n" + plainText.slice(0, 12000),
    });
    const doc = blocksToDoc(object.blocks);
    return { ok: true, doc: images.length ? reinsertImages(doc, images) : doc };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Falha da IA: ${msg}` };
  }
}
