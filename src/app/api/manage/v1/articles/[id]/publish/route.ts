import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorize, apiJson } from "@/lib/api/manage";
import { publishNodeCore } from "@/lib/content/publish-core";
import { enqueueNodeEmbedding } from "@/lib/jobs/boss";

export const runtime = "nodejs";

/**
 * POST /api/manage/v1/articles/{id}/publish — publica o nó (snapshot + reindex).
 * `{id}` = nodes.id. Auth: escopo `content.publish`.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize(req, "content.publish");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const db = createAdminClient();
  const { data: node } = await db.from("nodes").select("id, space_id, type").eq("id", id).maybeSingle();
  if (!node) return apiJson({ error: "Nó não encontrado." }, 404);
  if (node.type !== "article") return apiJson({ error: "Só artigos podem ser publicados por esta rota." }, 400);
  const r = await publishNodeCore(db, node.id, node.space_id, `Publicação via API (${auth.ctx.name})`, {
    enqueueEmbedding: (n, s) => enqueueNodeEmbedding(n, s, null),
  });
  if (!r.ok) return apiJson({ error: r.error }, 500);
  return apiJson({ ok: true, node_id: node.id });
}
