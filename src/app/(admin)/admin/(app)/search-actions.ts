"use server";

import { createClient } from "@/lib/supabase/server";

export type SearchHit = {
  node_id: string;
  title: string;
  heading_path: string | null;
  snippet: string;
  score: number;
};

export type SearchResult = { hits: SearchHit[]; error?: string };

/**
 * Busca híbrida (full-text + trigram, fundidos por RRF na RPC). Registra a
 * consulta em search_logs — buscas sem resultado revelam lacunas da doc.
 */
export async function searchContent(
  query: string,
  spaceId?: string | null,
): Promise<SearchResult> {
  const q = query.trim();
  if (q.length < 2) return { hits: [] };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("hybrid_search", {
    p_query: q,
    p_space_id: spaceId ?? undefined,
    p_limit: 20,
  });

  // Falha da RPC NÃO vira log: "0 resultados" alimenta a métrica de lacunas da
  // documentação, e indisponibilidade de infraestrutura passaria a ser contada
  // como buraco de conteúdo no painel e em Análises.
  if (error) {
    console.error("[searchContent] hybrid_search falhou:", error.message);
    return { hits: [], error: "A busca falhou. Tente novamente." };
  }

  const hits = (data ?? []) as SearchHit[];
  await supabase.from("search_logs").insert({
    query: q,
    results_count: hits.length,
    space_id: spaceId ?? null,
  });

  return { hits };
}
