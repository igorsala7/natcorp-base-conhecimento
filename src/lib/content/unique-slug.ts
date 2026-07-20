import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { slugify } from "./slug";

/**
 * Slug único dentro de (space_id, parent_id) — anexa -2, -3… se colidir.
 *
 * O índice único do banco é parcial (`where deleted_at is null`) e, na RAIZ,
 * `parent_id IS NULL` nunca colide em índice único no Postgres: por isso a
 * unicidade real da raiz depende desta função.
 */
export async function uniqueSlug(
  supabase: SupabaseClient<Database>,
  spaceId: string,
  parentId: string | null,
  base: string,
): Promise<string> {
  const root = slugify(base);
  let candidate = root;
  let n = 1;
  while (n < 50) {
    let q = supabase
      .from("nodes")
      .select("id")
      .eq("space_id", spaceId)
      .eq("slug", candidate)
      .is("deleted_at", null);
    q = parentId ? q.eq("parent_id", parentId) : q.is("parent_id", null);
    const { data } = await q.maybeSingle();
    if (!data) return candidate;
    n += 1;
    candidate = `${root}-${n}`;
  }
  return `${root}-${Date.now()}`;
}
