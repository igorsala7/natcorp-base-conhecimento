"use server";

import { createClient } from "@/lib/supabase/server";

export type SearchHit = {
  node_id: string;
  title: string;
  heading_path: string | null;
  snippet: string;
  score: number;
};

/**
 * Busca híbrida (full-text + trigram, fundidos por RRF na RPC). Registra a
 * consulta em search_logs — buscas sem resultado revelam lacunas da doc.
 */
export async function searchContent(
  query: string,
  spaceId?: string | null,
): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("hybrid_search", {
    p_query: q,
    p_space_id: spaceId ?? undefined,
    p_limit: 20,
  });

  const hits = (error ? [] : (data ?? [])) as SearchHit[];

  await supabase.from("search_logs").insert({
    query: q,
    results_count: hits.length,
    space_id: spaceId ?? null,
  });

  return hits;
}
