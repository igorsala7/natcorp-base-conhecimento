import "server-only";
import { createClient } from "@/lib/supabase/server";

export type TreeNode = {
  id: string;
  space_id: string;
  parent_id: string | null;
  type: "folder" | "article" | "link" | "divider";
  title: string;
  slug: string;
  position: string;
  icon: string | null;
  link_url: string | null;
  status: "draft" | "review" | "published";
  children: TreeNode[];
};

export type Space = {
  id: string;
  slug: string;
  name: string;
  type: string;
};

/** Espaço padrão (o global) — enquanto o seletor de espaços não existe. */
export async function getDefaultSpace(): Promise<Space | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("spaces")
    .select("id, slug, name, type")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
}

/** Carrega a árvore (não excluída) de um espaço, já aninhada e ordenada. */
export async function listTree(spaceId: string): Promise<TreeNode[]> {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("nodes")
    .select(
      "id, space_id, parent_id, type, title, slug, position, icon, link_url, status",
    )
    .eq("space_id", spaceId)
    .is("deleted_at", null)
    .order("position", { ascending: true });

  const byId = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];
  for (const r of rows ?? []) {
    byId.set(r.id, { ...(r as Omit<TreeNode, "children">), children: [] });
  }
  for (const node of byId.values()) {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  // Ordena cada nível por position (string base62 — ordem lexicográfica).
  const sortRec = (list: TreeNode[]) => {
    list.sort((a, b) => (a.position < b.position ? -1 : 1));
    list.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}
