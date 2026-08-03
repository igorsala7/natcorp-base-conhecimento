import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";
import { generateKeyBetween } from "fractional-indexing";
import { uniqueSlug } from "./unique-slug";
import { blocksToText } from "@/lib/blocks/serialize";
import type { Block } from "@/lib/blocks/schema";

type DbClient = SupabaseClient<Database>;

/**
 * Cria um nó (pasta/artigo) com um cliente EXPLÍCITO — admin no WORKER, usuário na
 * server action. A permissão é responsabilidade do chamador. Para `article`, grava
 * os blocos como conteúdo (content_json + content_text). O `path` (ltree) é resolvido
 * por trigger no insert. Devolve o id (ou null em falha). Espelha `createNode`.
 */
export async function criarNoConteudo(
  supabase: DbClient,
  input: { spaceId: string; parentId: string | null; type: "folder" | "article"; title: string; blocks?: Block[] },
): Promise<string | null> {
  const { spaceId, parentId, type, title } = input;

  let q = supabase.from("nodes").select("position").eq("space_id", spaceId).is("deleted_at", null).order("position", { ascending: false }).limit(1);
  q = parentId ? q.eq("parent_id", parentId) : q.is("parent_id", null);
  const { data: last } = await q.maybeSingle();
  const position = generateKeyBetween(last?.position ?? null, null);
  const slug = await uniqueSlug(supabase, spaceId, parentId, title);

  const { data: node } = await supabase
    .from("nodes")
    .insert({ space_id: spaceId, parent_id: parentId, type, title, slug, position })
    .select("id")
    .single();
  if (!node) return null;

  if (type === "article") {
    const blocks = input.blocks ?? [];
    const doc = { version: 2 as const, blocks };
    const texto = blocksToText(blocks);
    await supabase.from("articles").insert({ node_id: node.id, content_json: doc as unknown as Json, content_text: texto, excerpt: texto.slice(0, 200) });
  }
  return node.id;
}
