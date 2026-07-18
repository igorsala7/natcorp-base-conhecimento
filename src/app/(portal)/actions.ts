"use server";

import { createPublicClient } from "@/lib/supabase/public";

/** Registra feedback "Isso foi útil?" (visitante anônimo). */
export async function submitFeedback(
  nodeId: string,
  helpful: boolean,
): Promise<{ ok: boolean }> {
  const supabase = createPublicClient();
  const { error } = await supabase
    .from("article_feedback")
    .insert({ node_id: nodeId, helpful });
  return { ok: !error };
}
