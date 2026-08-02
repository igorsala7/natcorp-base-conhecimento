import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";

/**
 * Rastreio PASSO A PASSO de um turno de chat: cada decisão do fluxo (classificação,
 * RAG, ontologia, roteador de fonte, coleta, ferramentas montadas, chamadas de tool,
 * modelo, resposta) vira um passo com o tempo relativo. Serve para (1) o console do
 * navegador (via evento SSE) e (2) a página de LOG (persistido em ai_chat_traces).
 */
export type TracePasso = { ms: number; passo: string; info?: Record<string, unknown> };

export class ChatTrace {
  private t0 = Date.now();
  readonly passos: TracePasso[] = [];
  add(passo: string, info?: Record<string, unknown>): void {
    this.passos.push({ ms: Date.now() - this.t0, passo, info });
  }
  get duracaoMs(): number {
    return Date.now() - this.t0;
  }
}

export type TraceMeta = {
  conversationId?: string | null;
  spaceId?: string | null;
  base?: string | null;
  usuario?: string | null;
  portal?: string | null;
  empresa?: string | null;
  matricula?: string | null;
  perfil?: string | null;
  pergunta?: string | null;
  fonte?: string | null;
  desfecho: string; // como o turno terminou: "resposta", "clarify_fonte", "clarify_tool", "recusa", "erro"…
};

/** Grava o trace na tabela de log (service-role, fora do RLS). Best-effort — nunca derruba o chat. */
export async function persistirTrace(
  supabase: SupabaseClient<Database>,
  meta: TraceMeta,
  trace: ChatTrace,
): Promise<void> {
  try {
    await supabase.from("ai_chat_traces").insert({
      conversation_id: meta.conversationId ?? null,
      space_id: meta.spaceId ?? null,
      base_code: meta.base ?? null,
      p_usuario: meta.usuario ?? null,
      p_portal: meta.portal ?? null,
      p_empresa: meta.empresa ?? null,
      p_matricula: meta.matricula ?? null,
      p_perfil: meta.perfil ?? null,
      pergunta: (meta.pergunta ?? "").slice(0, 2000),
      fonte: meta.fonte ?? null,
      desfecho: meta.desfecho,
      duracao_ms: trace.duracaoMs,
      passos: trace.passos as unknown as Json,
    });
  } catch (e) {
    console.error("[ai_chat_traces] falha ao gravar:", e instanceof Error ? e.message : e);
  }
}
