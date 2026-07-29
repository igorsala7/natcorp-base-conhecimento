import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorize, apiJson } from "@/lib/api/manage";

export const runtime = "nodejs";

/**
 * GET /api/manage/v1/spaces — lista as documentações (espaços).
 * Auth: chave de API com escopo `content.view`.
 */
export async function GET(req: NextRequest) {
  const auth = await authorize(req, "content.view");
  if ("error" in auth) return auth.error;
  const db = createAdminClient();
  const { data, error } = await db
    .from("spaces")
    .select("id, slug, name, type, visibility, created_at")
    .order("name");
  if (error) return apiJson({ error: error.message }, 500);
  return apiJson({ spaces: data ?? [] });
}
