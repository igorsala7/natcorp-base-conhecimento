import "server-only";
import type { createClient } from "@/lib/supabase/server";

type TNode = { type: string; attrs?: Record<string, unknown>; text?: string; content?: TNode[] };

function textOf(node: TNode): string {
  if (node.text) return node.text;
  return (node.content ?? []).map(textOf).join(node.type === "paragraph" ? "" : " ");
}

export type Chunk = { heading_path: string; content: string };

/**
 * Particiona o documento por headings: cada H1/H2/H3 inicia um chunk, cujo
 * conteúdo é o texto até o próximo heading. heading_path acumula a trilha.
 */
export function chunkArticle(doc: TNode): Chunk[] {
  const blocks = doc.content ?? [];
  const chunks: Chunk[] = [];
  let trail: { level: number; text: string }[] = [];
  let current: { heading_path: string; parts: string[] } = {
    heading_path: "",
    parts: [],
  };

  const flush = () => {
    const content = current.parts.join("\n").replace(/\s+\n/g, "\n").trim();
    if (content) chunks.push({ heading_path: current.heading_path, content });
  };

  for (const block of blocks) {
    if (block.type === "heading") {
      flush();
      const level = (block.attrs?.level as number) ?? 1;
      const text = textOf(block).trim();
      trail = trail.filter((t) => t.level < level);
      trail.push({ level, text });
      current = {
        heading_path: trail.map((t) => t.text).join(" > "),
        parts: text ? [text] : [],
      };
    } else {
      current.parts.push(textOf(block));
    }
  }
  flush();
  return chunks;
}

/** Regenera os chunks de um nó (delete + insert). Idempotente. */
export async function reindexNodeChunks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: { nodeId: string; articleId: string; spaceId: string; doc: TNode },
): Promise<void> {
  const { nodeId, articleId, spaceId, doc } = params;
  await supabase.from("chunks").delete().eq("node_id", nodeId);
  const chunks = chunkArticle(doc);
  if (chunks.length === 0) return;
  await supabase.from("chunks").insert(
    chunks.map((c) => ({
      article_id: articleId,
      node_id: nodeId,
      space_id: spaceId,
      heading_path: c.heading_path || null,
      content: c.content,
      token_count: Math.ceil(c.content.length / 4),
    })),
  );
}
