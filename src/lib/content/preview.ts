import "server-only";
import { createClient } from "@/lib/supabase/server";
import { normalizeDoc } from "@/lib/blocks/convert";
import type { Block } from "@/lib/blocks/schema";
import type { TreeNode } from "@/lib/content/tree";

/**
 * Leitura para a PRÉVIA do admin: a documentação inteira como ficaria se tudo
 * fosse publicado agora — incluindo rascunhos e itens que nunca foram ao ar.
 *
 * Vive em `content/` e não em `portal/` de propósito. O portal público é a
 * camada que só enxerga conteúdo publicado; se um leitor privilegiado morasse
 * lá, bastaria um import errado numa rota pública para vazar rascunho. Aqui o
 * `server-only` e a separação de pasta tornam esse engano difícil, e a rota que
 * consome isto vive sob o layout autenticado do admin.
 *
 * Não há cliente de serviço envolvido: tudo passa pelo cliente do usuário
 * logado, então a RLS continua sendo quem decide o que ele pode ler.
 */

export type PreviewNode = TreeNode & {
  /** Caminho de slugs desde a raiz — usado só para gerar âncoras estáveis. */
  slugPath: string[];
  children: PreviewNode[];
};

export type PreviewArticle = {
  blocks: Block[];
  updatedAt: string | null;
  /** Há edição pendente ainda não publicada (tabela `article_drafts`). */
  hasDraft: boolean;
};

/** Anexa `slugPath` e ordena por posição, recursivamente. */
function comCaminho(nodes: TreeNode[], prefixo: string[]): PreviewNode[] {
  return [...nodes]
    .sort((a, b) => (a.position < b.position ? -1 : 1))
    .map((n) => {
      const slugPath = [...prefixo, n.slug];
      return { ...n, slugPath, children: comCaminho(n.children, slugPath) };
    });
}

/** Achata a árvore na ordem de leitura (profundidade primeiro). */
export function flattenPreview(nodes: PreviewNode[]): PreviewNode[] {
  return nodes.flatMap((n) => [n, ...flattenPreview(n.children)]);
}

/**
 * Árvore completa do espaço para a prévia: todos os status, sem os excluídos.
 * Reaproveita a mesma consulta da árvore do admin para que a prévia mostre
 * exatamente o que o editor mostra — se divergissem, a prévia mentiria.
 */
export async function getPreviewTree(spaceId: string): Promise<PreviewNode[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("nodes")
    .select("id, space_id, parent_id, type, title, slug, position, icon, link_url, status")
    .eq("space_id", spaceId)
    .is("deleted_at", null)
    .order("position", { ascending: true });

  const byId = new Map<string, TreeNode>();
  for (const n of data ?? []) byId.set(n.id, { ...(n as Omit<TreeNode, "children">), children: [] });
  const raizes: TreeNode[] = [];
  for (const node of byId.values()) {
    const pai = node.parent_id ? byId.get(node.parent_id) : null;
    if (pai) pai.children.push(node);
    else raizes.push(node);
  }
  return comCaminho(raizes, []);
}

/**
 * Conteúdo dos artigos, **preferindo o rascunho** quando existe: é justamente
 * o que ainda não está no ar que se quer conferir numa prévia.
 */
export async function getPreviewArticles(
  nodeIds: string[],
): Promise<Map<string, PreviewArticle>> {
  const out = new Map<string, PreviewArticle>();
  if (nodeIds.length === 0) return out;
  const supabase = await createClient();

  for (let i = 0; i < nodeIds.length; i += 200) {
    const lote = nodeIds.slice(i, i + 200);
    const [{ data: artigos }, { data: rascunhos }] = await Promise.all([
      supabase.from("articles").select("node_id, content_json, updated_at").in("node_id", lote),
      supabase
        .from("article_drafts")
        .select("node_id, content_json, updated_at")
        .in("node_id", lote),
    ]);

    for (const a of artigos ?? []) {
      out.set(a.node_id, {
        blocks: normalizeDoc(a.content_json).blocks,
        updatedAt: a.updated_at,
        hasDraft: false,
      });
    }
    // Rascunho sobrescreve o publicado — inclusive para nós sem linha em
    // `articles` (artigo criado e nunca publicado).
    for (const r of rascunhos ?? []) {
      out.set(r.node_id, {
        blocks: normalizeDoc(r.content_json).blocks,
        updatedAt: r.updated_at,
        hasDraft: true,
      });
    }
  }
  return out;
}

/** Snippets do espaço para transclusão (mesmo contrato do portal). */
export async function getPreviewSnippets(spaceId: string): Promise<Map<string, Block[]>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("snippets")
    .select("key, content_json")
    .eq("space_id", spaceId);
  const map = new Map<string, Block[]>();
  for (const s of data ?? []) map.set(s.key, normalizeDoc(s.content_json).blocks);
  return map;
}
