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
 * Busca híbrida (full-text + trigram, fundidos por RRF na RPC).
 *
 * NÃO registra nada: quem registra é `registrarBusca`, chamado por intenção.
 * Ver o comentário lá — gravar a cada tecla fazia o próprio time fabricar
 * "lacunas de documentação" ao digitar.
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

  return { hits: (data ?? []) as SearchHit[] };
}

/**
 * Registra a busca — por INTENÇÃO, não por tecla.
 *
 * A busca tem debounce e gravava a cada consulta: digitar "férias" produzia
 * `fé`, `féri`, `féria`, `férias` — quatro linhas, três com zero resultado. E
 * `results_count = 0` é justamente o que o Painel conta como "buscas sem
 * resultado" e Análises como "lacuna de conteúdo". A métrica crescia com o ato
 * de digitar.
 *
 * Agora só é chamado quando a pessoa ABRE um resultado (a busca serviu) ou
 * insiste numa consulta sem retorno (a busca falhou de verdade). Os dois são
 * intenção declarada; o resto é a pessoa pensando em voz alta.
 *
 * A origem separa quem procurou. O time interno procura de outro jeito —
 * "flow-canvas", o nome de um cliente — e contar isso junto com "como pedir
 * férias" mistura duas perguntas diferentes.
 */
export async function registrarBusca(
  query: string,
  resultados: number,
  origem: "portal" | "widget" | "admin",
  spaceId?: string | null,
): Promise<void> {
  const q = query.trim();
  if (q.length < 2) return;
  const supabase = await createClient();
  await supabase.from("search_logs").insert({
    query: q,
    results_count: resultados,
    space_id: spaceId ?? null,
    origin: origem,
  });
}
