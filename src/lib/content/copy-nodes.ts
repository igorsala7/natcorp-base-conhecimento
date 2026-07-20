import "server-only";
import { generateKeyBetween } from "fractional-indexing";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";
import { uniqueSlug } from "./unique-slug";

type Db = SupabaseClient<Database>;

type SrcNode = {
  id: string;
  parent_id: string | null;
  type: string;
  title: string;
  slug: string;
  position: string;
  status: string;
  link_url: string | null;
};

/**
 * Copia nós (com TODA a subárvore) de uma documentação para outra.
 *
 * Detalhes que importam:
 * - Insere PAI antes de FILHO: o `path` (ltree) é preenchido pelo trigger
 *   `set_node_path` no INSERT, a partir do pai — copiar em ordem topológica
 *   resolve o caminho de graça.
 * - Slug é recalculado no destino com `uniqueSlug` (a unicidade é por
 *   `(space_id, parent_id)`, e na raiz depende desta função).
 * - `position` é regerada no destino (fractional index), preservando a ORDEM
 *   relativa da origem.
 * - Artigos são lidos em LOTE e recriados 1:1 com o nó.
 *
 * Retorna quantos nós foram criados.
 */
export async function copyNodesDeep(
  supabase: Db,
  opts: {
    sourceSpaceId: string;
    /** Raízes a copiar; null = a documentação inteira. */
    rootIds: string[] | null;
    destSpaceId: string;
    destParentId: string | null;
  },
): Promise<number> {
  const { sourceSpaceId, rootIds, destSpaceId, destParentId } = opts;

  const { data: nodes } = await supabase
    .from("nodes")
    .select("id, parent_id, type, title, slug, position, status, link_url")
    .eq("space_id", sourceSpaceId)
    .is("deleted_at", null)
    .order("position");
  const all = (nodes ?? []) as SrcNode[];
  if (all.length === 0) return 0;

  const byParent = new Map<string | null, SrcNode[]>();
  for (const n of all) {
    const list = byParent.get(n.parent_id) ?? [];
    list.push(n);
    byParent.set(n.parent_id, list);
  }

  // Raízes: as pedidas (na ordem da árvore) ou o topo da documentação.
  const roots = rootIds
    ? all.filter((n) => rootIds.includes(n.id))
    : (byParent.get(null) ?? []);
  if (roots.length === 0) return 0;

  // Ids de todos os artigos que serão copiados (para ler o conteúdo em lote).
  const articleIds: string[] = [];
  const collect = (n: SrcNode) => {
    if (n.type === "article") articleIds.push(n.id);
    for (const c of byParent.get(n.id) ?? []) collect(c);
  };
  roots.forEach(collect);

  const contentByNode = new Map<string, Record<string, unknown>>();
  for (let i = 0; i < articleIds.length; i += 200) {
    const slice = articleIds.slice(i, i + 200);
    const { data: arts } = await supabase
      .from("articles")
      .select("node_id, content_json, content_text, excerpt, cover_image, meta")
      .in("node_id", slice);
    for (const a of arts ?? []) contentByNode.set(a.node_id, a);
  }

  let created = 0;

  const insertNode = async (src: SrcNode, parentId: string | null, prevPos: string | null) => {
    const slug = await uniqueSlug(supabase, destSpaceId, parentId, src.title || src.slug);
    const position = generateKeyBetween(prevPos, null);
    const { data: node, error } = await supabase
      .from("nodes")
      .insert({
        space_id: destSpaceId,
        parent_id: parentId,
        type: src.type,
        title: src.title,
        slug,
        position,
        status: src.status,
        link_url: src.link_url,
      })
      .select("id")
      .single();
    if (error || !node) throw new Error(error?.message ?? "falha ao copiar nó");
    created += 1;

    if (src.type === "article") {
      const a = contentByNode.get(src.id);
      await supabase.from("articles").insert({
        node_id: node.id,
        content_json: (a?.content_json ?? { version: 2, blocks: [] }) as Json,
        content_text: (a?.content_text as string | null) ?? null,
        excerpt: (a?.excerpt as string | null) ?? null,
        cover_image: (a?.cover_image as string | null) ?? null,
        meta: (a?.meta ?? {}) as Json,
      });
    }

    // Filhos, preservando a ordem da origem.
    let childPrev: string | null = null;
    for (const child of byParent.get(src.id) ?? []) {
      childPrev = await insertNode(child, node.id, childPrev);
    }
    return position;
  };

  // Continua depois do último irmão já existente no destino.
  let q = supabase
    .from("nodes")
    .select("position")
    .eq("space_id", destSpaceId)
    .is("deleted_at", null)
    .order("position", { ascending: false })
    .limit(1);
  q = destParentId ? q.eq("parent_id", destParentId) : q.is("parent_id", null);
  const { data: last } = await q.maybeSingle();

  let prev: string | null = last?.position ?? null;
  for (const root of roots) {
    prev = await insertNode(root, destParentId, prev);
  }
  return created;
}
