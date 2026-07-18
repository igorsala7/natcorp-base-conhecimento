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
const blocksSchema = z.object({
  blocks: z.array(
    z.discriminatedUnion("kind", [
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
    ]),
  ),
});

type Block = z.infer<typeof blocksSchema>["blocks"][number];

function blocksToTipTap(blocks: Block[]) {
  const content = blocks.map((b) => {
    switch (b.kind) {
      case "heading":
        return { type: "heading", attrs: { level: b.level }, content: [{ type: "text", text: b.text }] };
      case "callout":
        return {
          type: "callout",
          attrs: { variant: b.variant },
          content: [{ type: "paragraph", content: [{ type: "text", text: b.text }] }],
        };
      case "steps":
        return {
          type: "steps",
          content: b.items.map((t) => ({
            type: "stepItem",
            content: [{ type: "paragraph", content: [{ type: "text", text: t }] }],
          })),
        };
      case "bullets":
        return {
          type: "bulletList",
          content: b.items.map((t) => ({
            type: "listItem",
            content: [{ type: "paragraph", content: [{ type: "text", text: t }] }],
          })),
        };
      case "code":
        return {
          type: "codeBlock",
          attrs: { language: b.language ?? null },
          content: [{ type: "text", text: b.code }],
        };
      default:
        return { type: "paragraph", content: [{ type: "text", text: b.text }] };
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
