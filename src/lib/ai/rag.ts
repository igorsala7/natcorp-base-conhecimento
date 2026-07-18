import "server-only";
import { embed } from "ai";
import { createClient } from "@/lib/supabase/server";
import { embeddingModel, hasEmbeddingKey } from "@/lib/ai/config";
import { getEffectiveTreeAdmin, type EffectiveNode } from "@/lib/content/overlays";
import { slugify } from "@/lib/content/slug";

export type RetrievedSource = {
  n: number; // índice da citação [n]
  node_id: string;
  title: string;
  heading_path: string | null;
  content: string;
  url: string; // link para o portal (com âncora)
};

/** Contexto de recuperação de um espaço: nós efetivos + caminhos de slug. */
async function spaceContext(spaceId: string) {
  const supabase = await createClient();
  const { data: space } = await supabase
    .from("spaces")
    .select("slug")
    .eq("id", spaceId)
    .single();
  const tree = await getEffectiveTreeAdmin(spaceId);

  const slugPathById = new Map<string, string[]>();
  const nodeIds: string[] = [];
  const walk = (list: EffectiveNode[], prefix: string[]) => {
    for (const n of list) {
      const p = [...prefix, n.slug];
      slugPathById.set(n.id, p);
      nodeIds.push(n.id);
      walk(n.children, p);
    }
  };
  walk(tree, []);
  return { spaceSlug: space?.slug ?? "global", nodeIds, slugPathById };
}

/**
 * Recupera os trechos mais relevantes para a pergunta, DENTRO do espaço.
 * Busca híbrida escopada pelos nós efetivos (respeita overlays e isolamento).
 */
export async function retrieveContext(
  spaceId: string,
  query: string,
  limit = 8,
): Promise<RetrievedSource[]> {
  const supabase = await createClient();
  const { spaceSlug, nodeIds, slugPathById } = await spaceContext(spaceId);
  if (nodeIds.length === 0) return [];

  let embedding: number[] | null = null;
  if (hasEmbeddingKey()) {
    try {
      const { embedding: e } = await embed({ model: embeddingModel(), value: query });
      embedding = e;
    } catch {
      embedding = null;
    }
  }

  const { data } = await supabase.rpc("hybrid_search_scoped", {
    p_query: query,
    p_embedding: embedding ? JSON.stringify(embedding) : undefined,
    p_node_ids: nodeIds,
    p_limit: limit,
  });

  return (data ?? []).map((r, i) => {
    const slugPath = slugPathById.get(r.node_id) ?? [];
    const anchor = r.heading_path
      ? "#" + slugify(r.heading_path.split(" > ").pop() ?? "")
      : "";
    return {
      n: i + 1,
      node_id: r.node_id,
      title: r.title,
      heading_path: r.heading_path,
      content: r.content,
      url: `/docs/${spaceSlug}/${slugPath.join("/")}${anchor}`,
    } as RetrievedSource;
  });
}

/** Monta o bloco de contexto numerado para o prompt. */
export function buildContextBlock(sources: RetrievedSource[]): string {
  return sources
    .map(
      (s) =>
        `[${s.n}] ${s.title}${s.heading_path ? ` — ${s.heading_path}` : ""}\n${s.content}`,
    )
    .join("\n\n---\n\n");
}

export const RAG_SYSTEM_PROMPT = `Você é o assistente de documentação da Natcorp. Responda em português, de forma clara e objetiva.

REGRAS ABSOLUTAS:
- Responda APENAS com base no CONTEXTO fornecido. É PROIBIDO usar conhecimento geral seu.
- CITE as fontes ao longo da resposta usando os números entre colchetes, ex.: [1], [2]. Cada afirmação relevante deve ter uma citação.
- Se o contexto NÃO contiver a resposta, diga claramente que não encontrou essa informação na documentação e sugira procurar um atendente humano. Não invente.
- Não repita o contexto cru; escreva uma resposta útil e cite as fontes.`;
