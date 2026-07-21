"use server";

import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";
import { audit } from "@/lib/auth/audit";
import { reindexNodeChunks } from "@/lib/content/chunk";

/**
 * Reindexa os embeddings de TODOS os artigos de uma documentação.
 *
 * Mesmo motor de `reindexSubtreeEmbeddings` (árvore), sem precisar escolher um
 * nó: é o botão "Gerar embeddings" do hub de documentações.
 */
export async function reindexSpaceEmbeddings(
  spaceId: string,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  try {
    await requirePermission("content.edit", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }

  const supabase = await createClient();
  const { data: nodes } = await supabase
    .from("nodes")
    .select("id")
    .eq("space_id", spaceId)
    .eq("type", "article")
    .is("deleted_at", null);

  let count = 0;
  for (const n of nodes ?? []) {
    const { data: art } = await supabase
      .from("articles")
      .select("id, content_json")
      .eq("node_id", n.id)
      .maybeSingle();
    if (!art) continue;
    await reindexNodeChunks(supabase, {
      nodeId: n.id,
      articleId: art.id,
      spaceId,
      doc: art.content_json,
      withEmbeddings: true,
    });
    count += 1;
  }

  await audit({
    action: "content.reindex_space",
    entityType: "space",
    entityId: spaceId,
    spaceId,
    after: { count },
  });
  return { ok: true, count };
}
