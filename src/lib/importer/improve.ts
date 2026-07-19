import "server-only";
import { z } from "zod";
import { generateObject } from "ai";
import { chatModel, hasAiKey } from "@/lib/ai/config";
import { LAYOUT_INSTRUCTIONS } from "./prompts";

/**
 * "Melhorar layout" (Fase 4, etapa 4). Um passe de LLM que REFORMATA texto cru
 * em blocos ricos (callout, passo-a-passo, code, listas) — NÃO reescreve,
 * resume ou inventa. O usuário sempre revê o diff antes de aplicar.
 */
// Blocos "folha" (não-contêineres). Reaproveitados dentro de painel/colunas.
const leafOptions = [
  z.object({ kind: z.literal("paragraph"), text: z.string() }),
  z.object({ kind: z.literal("heading"), level: z.number().min(2).max(3), text: z.string() }),
  z.object({
    kind: z.literal("callout"),
    variant: z.enum(["info", "warning", "success", "danger"]),
    text: z.string(),
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
] as const;

type LeafBlock = z.infer<(typeof leafOptions)[number]>;

const blocksSchema = z.object({
  blocks: z.array(
    z.discriminatedUnion("kind", [
      ...leafOptions,
      // Painel = caixa colorida de destaque com parágrafos.
      // (Contém texto simples — não aninhamos a união de blocos folha aqui,
      //  senão a gramática de saída estruturada da IA fica grande demais.)
      z.object({
        kind: z.literal("panel"),
        bg: z.enum(["purple", "pink", "blue", "gray"]),
        items: z.array(z.string()),
      }),
      // Colunas = 2 colunas lado a lado, cada uma com parágrafos (texto simples).
      z.object({
        kind: z.literal("columns"),
        columns: z.array(z.array(z.string())),
      }),
    ]),
  ),
});

type Block = z.infer<typeof blocksSchema>["blocks"][number];

/** Nós de texto de uma célula/parágrafo (vazio → sem filhos, TipTap não aceita texto vazio). */
function textNode(t: string) {
  return t ? [{ type: "text", text: t }] : [];
}

function leafToTipTap(b: LeafBlock): object {
  switch (b.kind) {
    case "heading":
      return { type: "heading", attrs: { level: b.level }, content: textNode(b.text) };
    case "callout":
      return {
        type: "callout",
        attrs: { variant: b.variant },
        content: [{ type: "paragraph", content: textNode(b.text) }],
      };
    case "steps":
      return {
        type: "steps",
        content: b.items.map((t) => ({
          type: "stepItem",
          content: [{ type: "paragraph", content: textNode(t) }],
        })),
      };
    case "bullets":
      return {
        type: "bulletList",
        content: b.items.map((t) => ({
          type: "listItem",
          content: [{ type: "paragraph", content: textNode(t) }],
        })),
      };
    case "code":
      return {
        type: "codeBlock",
        attrs: { language: b.language ?? null },
        content: textNode(b.code),
      };
    case "table":
      return {
        type: "table",
        content: b.rows
          .filter((r) => r.length > 0)
          .map((row, ri) => ({
            type: "tableRow",
            content: row.map((cell) => ({
              type: ri === 0 ? "tableHeader" : "tableCell",
              content: [{ type: "paragraph", content: textNode(cell) }],
            })),
          })),
      };
    default:
      return { type: "paragraph", content: textNode(b.text) };
  }
}

/** Garante conteúdo mínimo (block+) para contêineres que não aceitam vazio. */
function nonEmpty(nodes: object[]): object[] {
  return nodes.length ? nodes : [{ type: "paragraph" }];
}

/** Texto simples → parágrafo TipTap. */
function paragraph(text: string): object {
  return { type: "paragraph", content: textNode(text) };
}

function blocksToTipTap(blocks: Block[]) {
  const content = blocks.map((b): object => {
    switch (b.kind) {
      case "panel":
        return {
          type: "panel",
          attrs: { bg: b.bg },
          content: nonEmpty(b.items.map(paragraph)),
        };
      case "columns":
        return {
          type: "columns",
          content: (b.columns.length ? b.columns : [[], []]).map((col) => ({
            type: "column",
            content: nonEmpty(col.map(paragraph)),
          })),
        };
      default:
        return leafToTipTap(b as LeafBlock);
    }
  });
  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
}

export type ImproveResult =
  | { ok: true; doc: object }
  | { ok: false; error: string };

export type ImageRef = { src: string; alt: string; caption: string };

const IMG_TOKEN = "⟦IMG:";
function imgNode(im: ImageRef): object {
  return { type: "figureImage", attrs: { src: im.src, alt: im.alt, caption: im.caption } };
}

/** Texto puro de um nó (concatena os text nodes). */
function plainOf(node: unknown): string {
  const parts: string[] = [];
  const walk = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    const o = n as { text?: string; content?: unknown[] };
    if (typeof o.text === "string") parts.push(o.text);
    if (Array.isArray(o.content)) o.content.forEach(walk);
  };
  walk(node);
  return parts.join("");
}

/** Remove os marcadores ⟦IMG:n⟧ dos text nodes; poda text nodes vazios. */
function stripTokens(node: unknown): unknown {
  if (!node || typeof node !== "object") return node;
  const o = node as { text?: string; content?: unknown[] };
  const clone: Record<string, unknown> = { ...o };
  if (typeof o.text === "string") {
    const t = o.text.replace(/⟦IMG:\d+⟧/g, "");
    if (!t.trim()) return null;
    clone.text = t;
  }
  if (Array.isArray(o.content)) {
    clone.content = o.content.map(stripTokens).filter((x) => x !== null);
  }
  return clone;
}

/**
 * Re-insere as imagens no lugar dos marcadores ⟦IMG:n⟧ que a IA preservou.
 * Qualquer imagem não colocada vai para o fim — nunca se perde uma imagem.
 */
function reinsertImages(doc: { type: string; content?: object[] }, images: ImageRef[]): object {
  const blocks = doc.content ?? [];
  const out: object[] = [];
  const placed = new Set<number>();

  for (const block of blocks) {
    const text = plainOf(block);
    if (!text.includes(IMG_TOKEN)) {
      out.push(block);
      continue;
    }
    const indices = [...text.matchAll(/⟦IMG:(\d+)⟧/g)].map((m) => Number(m[1]));
    const cleaned = stripTokens(block);
    if (cleaned && plainOf(cleaned).trim()) out.push(cleaned as object);
    for (const i of indices) {
      const im = images[i];
      if (im?.src && !placed.has(i)) {
        placed.add(i);
        out.push(imgNode(im));
      }
    }
  }
  // Rede de segurança: imagens que a IA "esqueceu" voltam ao final.
  images.forEach((im, i) => {
    if (im?.src && !placed.has(i)) out.push(imgNode(im));
  });

  return { type: "doc", content: out.length ? out : [{ type: "paragraph" }] };
}

/** Reformata o texto puro em blocos ricos, preservando as imagens. Exige AI_API_KEY. */
export async function improveLayout(
  plainText: string,
  images: ImageRef[] = [],
): Promise<ImproveResult> {
  if (!hasAiKey()) {
    return { ok: false, error: "AI_API_KEY não configurada — preencha no .env.local." };
  }
  if (!plainText.trim()) return { ok: false, error: "Sem conteúdo para melhorar." };

  try {
    const { object } = await generateObject({
      model: chatModel(),
      schema: blocksSchema,
      prompt: LAYOUT_INSTRUCTIONS + "\n\nTEXTO:\n" + plainText.slice(0, 12000),
    });
    const doc = blocksToTipTap(object.blocks) as { type: string; content?: object[] };
    return { ok: true, doc: images.length ? reinsertImages(doc, images) : doc };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Falha da IA: ${msg}` };
  }
}
