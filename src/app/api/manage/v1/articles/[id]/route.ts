import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorize, apiJson } from "@/lib/api/manage";
import { updateArticleViaApi } from "@/lib/api/content-write";

export const runtime = "nodejs";

/**
 * GET /api/manage/v1/articles/{id} — lê um artigo (nó + conteúdo).
 * `{id}` é o id do NÓ (nodes.id). Auth: escopo `content.view`.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize(req, "content.view");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const db = createAdminClient();
  const { data: node } = await db
    .from("nodes")
    .select("id, space_id, parent_id, type, title, slug, path, status, published_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (!node) return apiJson({ error: "Nó não encontrado." }, 404);
  const { data: article } = await db
    .from("articles")
    .select("content_json, content_html, content_text, excerpt, version, published_at, updated_at")
    .eq("node_id", id)
    .maybeSingle();
  return apiJson({ node, article: article ?? null });
}

/**
 * PATCH /api/manage/v1/articles/{id} — edita título e/ou conteúdo.
 * Body: { title?, text? | content_json? }. Auth: escopo `content.edit`.
 * Se o artigo está PUBLICADO, o conteúdo vai para rascunho (publique para ir ao ar).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize(req, "content.edit");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return apiJson({ error: "JSON inválido." }, 400);
  }
  const db = createAdminClient();
  const r = await updateArticleViaApi(db, id, {
    title: typeof body.title === "string" ? body.title : undefined,
    contentJson: body.content_json,
    text: typeof body.text === "string" ? body.text : undefined,
  });
  if (!r.ok) return apiJson({ error: r.error }, r.status);
  return apiJson({ ok: true, draft: r.draft });
}
