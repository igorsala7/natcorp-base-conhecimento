import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { fetchAllPaged } from "@/lib/supabase/paginate";

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

/** Todos os nós ativos de um espaço, PAGINADO (contorna o teto de 1000 linhas). */
async function fetchAllNodes(supabase: Client, cols: string, spaceId: string): Promise<NodeRow[]> {
  return fetchAllPaged<NodeRow>(async (from, to) => {
    const { data, error } = await supabase
      .from("nodes")
      .select(cols)
      .eq("space_id", spaceId)
      .is("deleted_at", null)
      .order("position", { ascending: true })
      .order("id")
      .range(from, to);
    return { data: (data ?? null) as NodeRow[] | null, error };
  });
}

type OverlayRow = { source_node_id: string; hidden: boolean; override_node_id: string | null };

/**
 * Todos os overlays de um espaço-cliente, PAGINADO. Sem isto, o teto de 1000
 * linhas do PostgREST cortava silenciosamente os overlays além da linha 1000 —
 * e os nós ocultos/sobrescritos correspondentes voltavam a contar como
 * "herdado" (visíveis), VAZANDO no portal público e no escopo do RAG. Ordena
 * por `source_node_id` (único por espaço) para paginar de forma estável.
 */
async function fetchAllOverlays(supabase: Client, spaceId: string): Promise<OverlayRow[]> {
  return fetchAllPaged<OverlayRow>(async (from, to) => {
    const { data, error } = await supabase
      .from("space_overlays")
      .select("source_node_id, hidden, override_node_id")
      .eq("space_id", spaceId)
      .order("source_node_id")
      .range(from, to);
    return { data: (data ?? null) as OverlayRow[] | null, error };
  });
}

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

  // Espaço próprio (global ou sem herança). Paginado: >1000 nós cortariam
  // linhas e os filhos dos nós cortados apareceriam na raiz (ver fetchAllPaged).
  if (space.type !== "client" || !space.parent_space_id) {
    const data = await fetchAllNodes(supabase, cols, spaceId);
    return buildTree(data, () => ({ badge: "proprio", sourceId: null, hidden: false }));
  }

  const globalId = space.parent_space_id;
  const [globalNodes, clientNodes, overlays] = await Promise.all([
    fetchAllNodes(supabase, cols, globalId),
    fetchAllNodes(supabase, cols, spaceId),
    fetchAllOverlays(supabase, spaceId),
  ]);

  const bySource = new Map<string, { hidden: boolean; override_node_id: string | null }>();
  const overrideToSource = new Map<string, string>();
  for (const o of overlays) {
    bySource.set(o.source_node_id, { hidden: o.hidden, override_node_id: o.override_node_id });
    if (o.override_node_id) overrideToSource.set(o.override_node_id, o.source_node_id);
  }

  const effective: NodeRow[] = [];
  const meta = new Map<string, { badge: Badge; sourceId: string | null; hidden: boolean }>();

  for (const g of globalNodes) {
    const ov = bySource.get(g.id);
    if (ov?.override_node_id) continue; // o fork do cliente substitui
    effective.push(g);
    meta.set(g.id, { badge: ov?.hidden ? "oculto" : "herdado", sourceId: null, hidden: !!ov?.hidden });
  }
  for (const c of clientNodes) {
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
