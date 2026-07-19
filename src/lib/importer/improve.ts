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

/** Reformata o texto puro em blocos ricos. Exige AI_API_KEY. */
export async function improveLayout(plainText: string): Promise<ImproveResult> {
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
    return { ok: true, doc: blocksToTipTap(object.blocks) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Falha da IA: ${msg}` };
  }
}
