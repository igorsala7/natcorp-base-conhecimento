import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Idempotência: registra o id da mensagem. Retorna true se ela JÁ havia sido
 * processada (a Meta reenviou) — nesse caso, ignore. Falhas que não sejam
 * duplicidade não bloqueiam o atendimento.
 */
export async function alreadyProcessed(messageId: string): Promise<boolean> {
  const db = createAdminClient();
  const { error } = await db.from("whatsapp_events").insert({ message_id: messageId });
  if (!error) return false; // inserção nova → primeira vez
  if (error.code === "23505") return true; // chave duplicada → já processada
  console.error("[whatsapp] dedupe:", error.message);
  return false;
}
