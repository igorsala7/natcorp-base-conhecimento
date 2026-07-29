import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorize, apiJson } from "@/lib/api/manage";

export const runtime = "nodejs";

/**
 * GET /api/manage/v1/spaces/{slug}/tree — árvore de nós (pastas/artigos) do espaço.
 * Auth: chave de API com escopo `content.view`.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const auth = await authorize(req, "content.view");
  if ("error" in auth) return auth.error;
  const { slug } = await params;
  const db = createAdminClient();
  const { data: space } = await db.from("spaces").select("id, slug, name").eq("slug", slug).maybeSingle();
  if (!space) return apiJson({ error: "Espaço não encontrado." }, 404);
  const { data: nodes, error } = await db
    .from("nodes")
    .select("id, parent_id, type, title, slug, path, position, status, icon, updated_at")
    .eq("space_id", space.id)
    .order("position")
    .range(0, 9999);
  if (error) return apiJson({ error: error.message }, 500);
  return apiJson({ space: { id: space.id, slug: space.slug, name: space.name }, nodes: nodes ?? [] });
}
