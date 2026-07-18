"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Registra feedback (👍 = 1, 👎 = -1) na ÚLTIMA resposta do assistente de uma
 * conversa. RLS garante que só quem vê o espaço da conversa consegue gravar.
 */
export async function submitChatFeedback(
  conversationId: string,
  value: 1 | -1,
): Promise<{ ok: boolean }> {
  if (!conversationId) return { ok: false };
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("messages")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!last) return { ok: false };
  const { error } = await supabase.from("messages").update({ feedback: value }).eq("id", last.id);
  return { ok: !error };
}
