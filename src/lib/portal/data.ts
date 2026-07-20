import "server-only";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPublicClient } from "@/lib/supabase/public";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";
import { getEffectiveTreePublic } from "@/lib/content/overlays";
import { spaceCookieName, verifySpaceToken } from "@/lib/portal/space-auth";
import { normalizeDoc } from "@/lib/blocks/convert";
import type { Block } from "@/lib/blocks/schema";

type PortalDb = SupabaseClient<Database>;

export type PublicSpace = {
  id: string;
  slug: string;
  name: string;
  theme: Record<string, unknown>;
};

export type PortalSpace = PublicSpace & {
  visibility: "public" | "password";
  type: string;
  parent_space_id: string | null;
};

/**
 * Resolve um espaço acessível pelo portal (público OU protegido por senha),
 * via service-role — pois o anon não enxerga espaços 'password' na RLS.
 * Retorna null para privados/inexistentes.
 */
export async function resolvePortalSpace(spaceSlug: string): Promise<PortalSpace | null> {
  const supabase = createAdminClient();
  let { data } = await supabase
    .from("spaces")
    .select("id, slug, name, theme, visibility, type, parent_space_id")
    .eq("slug", spaceSlug)
    .in("visibility", ["public", "password"])
    .maybeSingle();

  // Não é a slug atual: pode ser uma APOSENTADA. Resolver pelo histórico é o
  // que mantém vivo todo link já compartilhado — quem chama compara
  // `space.slug` com o que veio na URL e responde 301 quando diferem.
  if (!data) {
    const { data: hist } = await supabase
      .from("space_slugs")
      .select("space_id")
      .eq("slug", spaceSlug)
      .maybeSingle();
    if (!hist) return null;
    const { data: porId } = await supabase
      .from("spaces")
      .select("id, slug, name, theme, visibility, type, parent_space_id")
      .eq("id", hist.space_id)
      .in("visibility", ["public", "password"])
      .maybeSingle();
    data = porId;
  }
  if (!data) return null;
  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    theme: (data.theme as Record<string, unknown>) ?? {},
    visibility: data.visibility as "public" | "password",
    type: data.type,
    parent_space_id: data.parent_space_id,
  };
}

export type PublicNode = {
  id: string;
  parent_id: string | null;
  type: "folder" | "article" | "link" | "divider";
  title: string;
  slug: string;
  position: string;
  link_url: string | null;
  updated_at: string;
};

export type PortalTreeNode = PublicNode & {
  slugPath: string[];
  children: PortalTreeNode[];
};

/** Espaço público pelo slug. */
export async function getPublicSpace(
  spaceSlug: string,
): Promise<PublicSpace | null> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("spaces")
    .select("id, slug, name, theme")
    .eq("slug", spaceSlug)
    .eq("visibility", "public")
    .maybeSingle();
  if (!data) return null;
  return { ...data, theme: (data.theme as Record<string, unknown>) ?? {} };
}

export type PortalAccess =
  | { space: PortalSpace; locked: true; db: null }
  | { space: PortalSpace; locked: false; db: PortalDb };

/**
 * Resolve o acesso do portal a um espaço:
 * - público → cliente anon (RLS);
 * - com senha → se o cookie assinado for válido, cliente service-role; senão
 *   `locked` (a página mostra o formulário de senha);
 * - privado/inexistente → null (404).
 */
export async function getPortalAccess(spaceSlug: string): Promise<PortalAccess | null> {
  const space = await resolvePortalSpace(spaceSlug);
  if (!space) return null;
  if (space.visibility === "password") {
    const token = (await cookies()).get(spaceCookieName(space.id))?.value;
    if (!verifySpaceToken(space.id, token)) return { space, locked: true, db: null };
    return { space, locked: false, db: createAdminClient() };
  }
  return { space, locked: false, db: createPublicClient() };
}

/** Todos os nós publicados do espaço (flat), ordenados por posição. */
async function fetchPublishedNodes(spaceId: string, db: PortalDb): Promise<PublicNode[]> {
  const { data } = await db
    .from("nodes")
    .select("id, parent_id, type, title, slug, position, link_url, updated_at")
    .eq("space_id", spaceId)
    .eq("status", "published")
    .is("deleted_at", null)
    .order("position", { ascending: true });
  return (data ?? []) as PublicNode[];
}

/**
 * Monta a árvore publicada com o caminho de slugs. Resolve overlays: para um
 * espaço-cliente, a árvore efetiva é global − ocultos ⊕ sobrescritos ∪ exclusivos.
 */
export async function getPortalTree(
  spaceId: string,
  db: PortalDb = createPublicClient(),
): Promise<PortalTreeNode[]> {
  const { data: space } = await db
    .from("spaces")
    .select("type, parent_space_id")
    .eq("id", spaceId)
    .maybeSingle();

  let roots: PortalTreeNode[];
  if (space?.type === "client" && space.parent_space_id) {
    // Árvore efetiva já vem aninhada e podada (só publicado, sem ocultos).
    const eff = await getEffectiveTreePublic(spaceId, db);
    const toPortal = (list: typeof eff): PortalTreeNode[] =>
      list.map((n) => ({
        id: n.id,
        parent_id: n.parent_id,
        type: n.type,
        title: n.title,
        slug: n.slug,
        position: n.position,
        link_url: n.link_url,
        updated_at: n.updated_at,
        slugPath: [],
        children: toPortal(n.children),
      }));
    roots = toPortal(eff);
  } else {
    const nodes = await fetchPublishedNodes(spaceId, db);
    const byId = new Map<string, PortalTreeNode>();
    for (const n of nodes) byId.set(n.id, { ...n, slugPath: [], children: [] });
    roots = [];
    for (const node of byId.values()) {
      const parent = node.parent_id ? byId.get(node.parent_id) : null;
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
  }

  const assign = (list: PortalTreeNode[], prefix: string[]) => {
    list.sort((a, b) => (a.position < b.position ? -1 : 1));
    for (const n of list) {
      n.slugPath = [...prefix, n.slug];
      assign(n.children, n.slugPath);
    }
  };
  assign(roots, []);
  return roots;
}

/** Achata a árvore para busca/ordem linear (nav e prev/next). */
export function flattenPortalTree(tree: PortalTreeNode[]): PortalTreeNode[] {
  return tree.flatMap((n) => [n, ...flattenPortalTree(n.children)]);
}

/** Resolve um nó a partir do caminho de slugs. */
export function resolveByPath(
  tree: PortalTreeNode[],
  segments: string[],
): PortalTreeNode | null {
  let level = tree;
  let found: PortalTreeNode | null = null;
  for (const seg of segments) {
    found = level.find((n) => n.slug === seg) ?? null;
    if (!found) return null;
    level = found.children;
  }
  return found;
}

/** Consulta a tabela de redirects para um caminho antigo. */
export async function findRedirect(
  spaceId: string,
  fromPath: string,
  db: PortalDb = createPublicClient(),
): Promise<string | null> {
  const { data } = await db
    .from("redirects")
    .select("to_node_id")
    .eq("space_id", spaceId)
    .eq("from_path", fromPath)
    .maybeSingle();
  return data?.to_node_id ?? null;
}

/** Conteúdo do artigo publicado de um nó. */
export async function getPublicArticle(nodeId: string, db: PortalDb = createPublicClient()) {
  const { data } = await db
    .from("articles")
    .select("content_json, excerpt, updated_at, cover_image, meta")
    .eq("node_id", nodeId)
    .maybeSingle();
  return data;
}

/**
 * Artigos de vários nós de uma vez — para a página de leitura contínua, que
 * mostra todos os artigos de um diretório num scroll só.
 */
export async function getPublicArticles(
  nodeIds: string[],
  db: PortalDb = createPublicClient(),
): Promise<Map<string, { content_json: unknown; excerpt: string | null; updated_at: string }>> {
  const out = new Map<string, { content_json: unknown; excerpt: string | null; updated_at: string }>();
  for (let i = 0; i < nodeIds.length; i += 200) {
    const { data } = await db
      .from("articles")
      .select("node_id, content_json, excerpt, updated_at")
      .in("node_id", nodeIds.slice(i, i + 200));
    for (const a of data ?? []) {
      out.set(a.node_id, {
        content_json: a.content_json,
        excerpt: a.excerpt,
        updated_at: a.updated_at,
      });
    }
  }
  return out;
}

/** Mapa de snippets do espaço (chave → blocos) para transclusão. */
export async function getPublicSnippets(
  spaceId: string,
  db: PortalDb = createPublicClient(),
): Promise<Map<string, Block[]>> {
  const { data } = await db
    .from("snippets")
    .select("key, content_json")
    .eq("space_id", spaceId);
  const map = new Map<string, Block[]>();
  for (const s of data ?? []) {
    map.set(s.key, normalizeDoc(s.content_json).blocks);
  }
  return map;
}

/** Cadeia de ancestrais (para breadcrumbs), do topo até o nó. */
export function ancestorsOf(
  tree: PortalTreeNode[],
  nodeId: string,
): PortalTreeNode[] {
  const flat = flattenPortalTree(tree);
  const byId = new Map(flat.map((n) => [n.id, n]));
  const chain: PortalTreeNode[] = [];
  let current = byId.get(nodeId) ?? null;
  while (current) {
    chain.unshift(current);
    current = current.parent_id ? (byId.get(current.parent_id) ?? null) : null;
  }
  return chain;
}
