import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";

export type Badge =
  | "proprio" // espaço global (ou nó do próprio espaço)
  | "herdado" // vem do global, sem customização
  | "customizado" // fork do cliente sobre o global
  | "oculto" // herdado, mas ocultado pelo cliente
  | "exclusivo"; // criado só no espaço-cliente

export type EffectiveNode = {
  id: string; // nó para carregar conteúdo (global ou do cliente)
  sourceId: string | null; // nó global de origem (para customizado)
  parent_id: string | null;
  type: "folder" | "article" | "link" | "divider";
  title: string;
  slug: string;
  position: string;
  status: "draft" | "review" | "published";
  link_url: string | null;
  icon: string | null;
  description: string | null;
  updated_at: string;
  badge: Badge;
  hidden: boolean;
  children: EffectiveNode[];
};

type NodeRow = {
  id: string;
  space_id: string;
  parent_id: string | null;
  type: EffectiveNode["type"];
  title: string;
  slug: string;
  position: string;
  status: EffectiveNode["status"];
  link_url: string | null;
  icon: string | null;
  description: string | null;
  updated_at: string;
};

type Client = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createPublicClient>;

/**
 * Resolve a árvore efetiva de um espaço.
 * - Espaço global (ou sem pai): a própria árvore, badge 'proprio'.
 * - Espaço-cliente: global − ocultos ⊕ sobrescritos ∪ exclusivos, com badges.
 */
async function resolveTree(
  supabase: Client,
  spaceId: string,
): Promise<EffectiveNode[]> {
  const { data: space } = await supabase
    .from("spaces")
    .select("id, type, parent_space_id")
    .eq("id", spaceId)
    .maybeSingle();
  if (!space) return [];

  const cols =
    "id, space_id, parent_id, type, title, slug, position, status, link_url, icon, description, updated_at";

  // Espaço próprio (global ou sem herança).
  if (space.type !== "client" || !space.parent_space_id) {
    const { data } = await supabase
      .from("nodes")
      .select(cols)
      .eq("space_id", spaceId)
      .is("deleted_at", null);
    return buildTree((data ?? []) as NodeRow[], () => ({ badge: "proprio", sourceId: null, hidden: false }));
  }

  const globalId = space.parent_space_id;
  const [{ data: globalNodes }, { data: clientNodes }, { data: overlays }] =
    await Promise.all([
      supabase.from("nodes").select(cols).eq("space_id", globalId).is("deleted_at", null),
      supabase.from("nodes").select(cols).eq("space_id", spaceId).is("deleted_at", null),
      supabase.from("space_overlays").select("source_node_id, hidden, override_node_id").eq("space_id", spaceId),
    ]);

  const bySource = new Map<string, { hidden: boolean; override_node_id: string | null }>();
  const overrideToSource = new Map<string, string>();
  for (const o of overlays ?? []) {
    bySource.set(o.source_node_id, { hidden: o.hidden, override_node_id: o.override_node_id });
    if (o.override_node_id) overrideToSource.set(o.override_node_id, o.source_node_id);
  }

  const effective: NodeRow[] = [];
  const meta = new Map<string, { badge: Badge; sourceId: string | null; hidden: boolean }>();

  for (const g of (globalNodes ?? []) as NodeRow[]) {
    const ov = bySource.get(g.id);
    if (ov?.override_node_id) continue; // o fork do cliente substitui
    effective.push(g);
    meta.set(g.id, { badge: ov?.hidden ? "oculto" : "herdado", sourceId: null, hidden: !!ov?.hidden });
  }
  for (const c of (clientNodes ?? []) as NodeRow[]) {
    effective.push(c);
    const src = overrideToSource.get(c.id);
    meta.set(c.id, {
      badge: src ? "customizado" : "exclusivo",
      sourceId: src ?? null,
      hidden: false,
    });
  }

  return buildTree(effective, (id) => meta.get(id) ?? { badge: "herdado", sourceId: null, hidden: false });
}

function buildTree(
  rows: NodeRow[],
  metaOf: (id: string) => { badge: Badge; sourceId: string | null; hidden: boolean },
): EffectiveNode[] {
  const byId = new Map<string, EffectiveNode>();
  for (const r of rows) {
    const m = metaOf(r.id);
    byId.set(r.id, { ...r, ...m, children: [] });
  }
  const roots: EffectiveNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parent_id ? byId.get(node.parent_id) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sort = (list: EffectiveNode[]) => {
    list.sort((a, b) => (a.position < b.position ? -1 : 1));
    list.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

/** Árvore efetiva para o admin (inclui nós ocultos, marcados). */
export async function getEffectiveTreeAdmin(spaceId: string): Promise<EffectiveNode[]> {
  const supabase = await createClient();
  return resolveTree(supabase, spaceId);
}

/** Árvore efetiva para o portal público (só publicado, sem ocultos). */
export async function getEffectiveTreePublic(
  spaceId: string,
  client?: Client,
): Promise<EffectiveNode[]> {
  const supabase = client ?? createPublicClient();
  const tree = await resolveTree(supabase, spaceId);
  const prune = (nodes: EffectiveNode[]): EffectiveNode[] =>
    nodes
      .filter((n) => !n.hidden && n.status === "published")
      .map((n) => ({ ...n, children: prune(n.children) }));
  return prune(tree);
}
