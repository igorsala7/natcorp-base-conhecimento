import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorize, apiJson } from "@/lib/api/manage";
import { createArticleViaApi } from "@/lib/api/content-write";

export const runtime = "nodejs";

/**
 * POST /api/manage/v1/articles — cria um artigo.
 * Body: { space (slug) | space_id, parent_id?, title, text? | content_json? }
 * Auth: escopo `content.create`. O artigo nasce como rascunho (use /publish).
 */
export async function POST(req: NextRequest) {
  const auth = await authorize(req, "content.create");
  if ("error" in auth) return auth.error;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiJson({ error: "JSON inválido." }, 400);
  }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return apiJson({ error: "Informe 'title'." }, 400);

  const db = createAdminClient();
  let spaceId = typeof body.space_id === "string" ? body.space_id : null;
  if (!spaceId && typeof body.space === "string") {
    const { data: s } = await db.from("spaces").select("id").eq("slug", body.space).maybeSingle();
    spaceId = s?.id ?? null;
  }
  if (!spaceId) return apiJson({ error: "Informe 'space' (slug) ou 'space_id'." }, 400);
  const { data: sp } = await db.from("spaces").select("id").eq("id", spaceId).maybeSingle();
  if (!sp) return apiJson({ error: "Espaço não encontrado." }, 404);

  const parentId = typeof body.parent_id === "string" ? body.parent_id : null;
  const r = await createArticleViaApi(db, {
    spaceId,
    parentId,
    title,
    contentJson: body.content_json,
    text: typeof body.text === "string" ? body.text : undefined,
  });
  if (!r.ok) return apiJson({ error: r.error }, r.status);
  return apiJson({ ok: true, node_id: r.nodeId, slug: r.slug }, 201);
}
