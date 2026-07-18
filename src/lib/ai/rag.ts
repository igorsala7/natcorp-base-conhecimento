import "server-only";
import { embed } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";
import { embeddingModel, hasEmbeddingKey } from "@/lib/ai/config";
import {
  getEffectiveTreeAdmin,
  getEffectiveTreePublic,
  type EffectiveNode,
} from "@/lib/content/overlays";
import { slugify } from "@/lib/content/slug";

type DbClient = SupabaseClient<Database>;

export type RetrievedSource = {
  n: number; // índice da citação [n]
  node_id: string;
  title: string;
  heading_path: string | null;
  content: string;
  snippet: string | null; // trecho destacado (para busca)
  url: string; // link para o portal (com âncora)
};

/** Nós efetivos + caminhos de slug, a partir de uma árvore já resolvida. */
async function spaceContext(
  supabase: DbClient,
  spaceId: string,
  tree: EffectiveNode[],
) {
  const { data: space } = await supabase
    .from("spaces")
    .select("slug")
    .eq("id", spaceId)
    .maybeSingle();

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

/** Núcleo da recuperação: busca híbrida escopada pelos nós de `tree`. */
async function retrieveWith(
  supabase: DbClient,
  spaceId: string,
  query: string,
  limit: number,
  tree: EffectiveNode[],
): Promise<RetrievedSource[]> {
  const { spaceSlug, nodeIds, slugPathById } = await spaceContext(
    supabase,
    spaceId,
    tree,
  );
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
      snippet: r.snippet ?? null,
      url: `/docs/${spaceSlug}/${slugPath.join("/")}${anchor}`,
    } as RetrievedSource;
  });
}

/**
 * Recupera os trechos mais relevantes para a pergunta, DENTRO do espaço.
 * Caminho AUTENTICADO (admin/portal): usa a sessão e a árvore completa.
 */
export async function retrieveContext(
  spaceId: string,
  query: string,
  limit = 8,
): Promise<RetrievedSource[]> {
  const supabase = await createClient();
  const tree = await getEffectiveTreeAdmin(spaceId);
  return retrieveWith(supabase as DbClient, spaceId, query, limit, tree);
}

/**
 * Caminho PÚBLICO (widget / API v1): sem sessão. Escopo = árvore pública do
 * espaço (só publicado, respeitando overlays). Usa service-role para ler os
 * chunks e escrever conversas mesmo em espaços privados vinculados à chave.
 */
export async function retrievePublicContext(
  spaceId: string,
  query: string,
  limit = 8,
): Promise<RetrievedSource[]> {
  const supabase = createAdminClient();
  const tree = await getEffectiveTreePublic(spaceId);
  return retrieveWith(supabase, spaceId, query, limit, tree);
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
