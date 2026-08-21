import "server-only";
import { createClient } from "@/lib/supabase/server";
import { fetchAllPaged } from "@/lib/supabase/paginate";

export type TreeNode = {
  id: string;
  space_id: string;
  parent_id: string | null;
  type: "folder" | "article" | "link" | "divider";
  title: string;
  slug: string;
  position: string;
  icon: string | null;
  description: string | null;
  link_url: string | null;
  status: "draft" | "review" | "published";
  /** Agendamentos de publicação (badge de relógio na árvore). */
  publish_at: string | null;
  unpublish_at: string | null;
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

/**
 * Mapa id → caminho de slugs (completo) de todos os nós do espaço.
 * Usado para gerar redirects quando um slug muda.
 */
export async function slugPathsOf(
  spaceId: string,
): Promise<Map<string, string[]>> {
  const tree = await listTree(spaceId);
  const map = new Map<string, string[]>();
  const walk = (nodes: TreeNode[], prefix: string[]) => {
    for (const n of nodes) {
      const p = [...prefix, n.slug];
      map.set(n.id, p);
      walk(n.children, p);
    }
  };
  walk(tree, []);
  return map;
}

/** IDs do nó e de toda a sua subárvore. */
export async function subtreeIds(
  spaceId: string,
  nodeId: string,
): Promise<string[]> {
  const tree = await listTree(spaceId);
  const ids: string[] = [];
  const find = (nodes: TreeNode[]): TreeNode | null => {
    for (const n of nodes) {
      if (n.id === nodeId) return n;
      const found = find(n.children);
      if (found) return found;
    }
    return null;
  };
  const collect = (n: TreeNode) => {
    ids.push(n.id);
    n.children.forEach(collect);
  };
  const target = find(tree);
  if (target) collect(target);
  return ids;
}

/**
 * IDs dos nós (artigos) que JÁ têm embedding gerado no espaço — para a bolinha
 * de "indexado" na árvore. Só conta o chunk com vetor de fato (embedding não
 * nulo); o chunk só-texto (busca léxica) não acende. Degrada para vazio se a
 * RLS negar (a árvore só perde a bolinha, nunca quebra).
 */
export async function embeddedNodeIds(spaceId: string): Promise<string[]> {
  const supabase = await createClient();
  const set = new Set<string>();
  // Pagina de 1000 em 1000: um espaço tem MILHARES de chunks e o PostgREST
  // corta em 1000 por requisição (era o bug de a bolinha só aparecer em parte).
  for (let i = 0; ; i += 1000) {
    const { data, error } = await supabase
      .from("chunks")
      .select("node_id")
      .eq("space_id", spaceId)
      .not("node_id", "is", null)
      .not("embedding", "is", null)
      .range(i, i + 999);
    if (error || !data || data.length === 0) break;
    for (const r of data) if (r.node_id) set.add(r.node_id);
    if (data.length < 1000) break;
  }
  return [...set];
}

/**
 * IDs dos artigos JÁ VARRIDOS pela ontologia (bolinha cinza escura na árvore).
 * `articles` não tem `space_id` — filtra pelos nós-artigo do espaço.
 */
export async function ontologyNodeIds(spaceId: string): Promise<string[]> {
  const supabase = await createClient();
  // Paginado: `natcorp` tem 4.314 artigos e o PostgREST corta em 1.000 sem
  // avisar. Cortado aqui, a árvore mostraria "sem ontologia" para 3 de cada 4
  // artigos JÁ varridos — um relatório que mente para menos, e que levaria
  // alguém a mandar varrer tudo de novo.
  const nodes = await fetchAllPaged<{ id: string }>((de, ate) =>
    supabase
      .from("nodes")
      .select("id")
      .eq("space_id", spaceId)
      .eq("type", "article")
      .is("deleted_at", null)
      .order("id")
      .range(de, ate),
  );
  const nodeIds = nodes.map((n) => n.id);
  const set = new Set<string>();
  for (let i = 0; i < nodeIds.length; i += 200) {
    const { data } = await supabase
      .from("articles")
      .select("node_id")
      .in("node_id", nodeIds.slice(i, i + 200))
      .not("ontology_at", "is", null);
    for (const a of data ?? []) if (a.node_id) set.add(a.node_id);
  }
  return [...set];
}

/**
 * Ids dos artigos com RASCUNHO PENDENTE — edições salvas mas NÃO publicadas
 * (`article_drafts`). É o que o editor mostra como "Alterações não publicadas".
 */
export async function pendingDraftNodeIds(spaceId: string): Promise<string[]> {
  const supabase = await createClient();
  const nodesRows = await fetchAllPaged<{ id: string }>(async (from, to) => {
    const { data, error } = await supabase
      .from("nodes")
      .select("id")
      .eq("space_id", spaceId)
      .eq("type", "article")
      .is("deleted_at", null)
      .order("id")
      .range(from, to);
    return { data, error };
  });
  const nodeIds = nodesRows.map((n) => n.id);
  const set = new Set<string>();
  for (let i = 0; i < nodeIds.length; i += 200) {
    const { data } = await supabase
      .from("article_drafts")
      .select("node_id")
      .in("node_id", nodeIds.slice(i, i + 200));
    for (const d of data ?? []) if (d.node_id) set.add(d.node_id);
  }
  return [...set];
}

/** Carrega a árvore (não excluída) de um espaço, já aninhada e ordenada. */
export async function listTree(spaceId: string): Promise<TreeNode[]> {
  const supabase = await createClient();
  // Paginado: um espaço com >1000 nós cortaria linhas e os filhos dos nós
  // cortados apareceriam na raiz (como se tivessem sido movidos). Ver fetchAllPaged.
  const rows = await fetchAllPaged<Omit<TreeNode, "children">>(async (from, to) => {
    const { data, error } = await supabase
      .from("nodes")
      .select(
        "id, space_id, parent_id, type, title, slug, position, icon, description, link_url, status, publish_at, unpublish_at",
      )
      .eq("space_id", spaceId)
      .is("deleted_at", null)
      .order("position", { ascending: true })
      .order("id")
      .range(from, to);
    return { data: (data ?? null) as Omit<TreeNode, "children">[] | null, error };
  });

  const byId = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];
  for (const r of rows) {
    byId.set(r.id, { ...r, children: [] });
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
