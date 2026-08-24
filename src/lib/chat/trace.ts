import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";
import { podarInfo } from "./trace-limits";

/**
 * Rastreio PASSO A PASSO de um turno de chat: cada decisão do fluxo (classificação,
 * RAG, ontologia, roteador de fonte, coleta, ferramentas montadas, chamadas de tool,
 * modelo, resposta) vira um passo com o tempo relativo. Serve para (1) o console do
 * navegador (via evento SSE) e (2) a página de LOG (persistido em ai_chat_traces).
 */
export type TracePasso = { ms: number; passo: string; info?: Record<string, unknown> };

/** Tetos do trace. Um turno com muitas chamadas de ferramenta emite um passo POR
 *  chamada; sem limite, a coluna `passos` (jsonb) cresce sem teto e a tela de logs
 *  fica pesada. O corte é do registro, nunca do comportamento do chat. */
const MAX_PASSOS = 200;
const MAX_INFO_CHARS = 4000;
/** Vagas guardadas para `addFinal`: o desfecho do turno não pode ser a primeira
 *  coisa a sumir quando o teto estoura — é ele que explica o resto. */
const VAGAS_FINAIS = 8;

export class ChatTrace {
  private t0 = Date.now();
  /** Quantos passos foram recusados pelo teto (vira sentinela no fim). */
  private descartados = 0;
  readonly passos: TracePasso[] = [];

  private push(passo: string, info: Record<string, unknown> | undefined): void {
    this.passos.push({ ms: Date.now() - this.t0, passo, info: podarInfo(info, MAX_INFO_CHARS) });
  }

  add(passo: string, info?: Record<string, unknown>): void {
    if (this.passos.length >= MAX_PASSOS - VAGAS_FINAIS) {
      this.descartados++;
      return;
    }
    this.push(passo, info);
  }

  /**
   * Passo que SEMPRE entra (desfecho, resposta, registro de dataset). Sem isto,
   * um turno com dezenas de chamadas perdia justamente o fim — e "turno acabou"
   * ficava indistinguível de "log cortado" na tela.
   */
  addFinal(passo: string, info?: Record<string, unknown>): void {
    if (this.descartados > 0 && !this.passos.some((p) => p.passo === "_teto_passos")) {
      this.push("_teto_passos", { descartados: this.descartados, teto: MAX_PASSOS });
    }
    if (this.passos.length >= MAX_PASSOS) return;
    this.push(passo, info);
  }

  get duracaoMs(): number {
    return Date.now() - this.t0;
  }
}

export type TraceMeta = {
  /**
   * Id do trace, GERADO NO SERVIDOR antes de gravar.
   *
   * `ai_chat_traces.id` tem `default gen_random_uuid()`, e este insert é
   * disparado com `void` e sem `.select()` — o servidor nunca soube qual linha
   * gravou. Isso bastava enquanto o trace era só log, e deixou de bastar quando
   * `ai_tool_casos` passou a precisar apontar para ele: sem o id, o caso
   * rotulado não consegue recuperar o cardápio, as similaridades e os passos
   * que produziram a decisão que se está julgando.
   *
   * Ausente = o banco gera, como antes.
   */
  id?: string | null;
  /**
   * Turno do chat, o mesmo valor que vai para `ai_usage.turn_id` e
   * `messages.turn_id`.
   *
   * É o que liga O QUE o turno fez (aqui) a QUANTO ele custou (lá). Sem isto dá
   * para somar o custo total do período e contar os turnos de um recorte, mas
   * não para cruzar os dois — e toda decisão de custo é por recorte, não pelo
   * total.
   *
   * Nasce em `POST` (`ctxConsumo.turnId`) antes de qualquer chamada de IA,
   * justamente para já estar pronto quando o trace for gravado no fim.
   */
  turnId?: string | null;
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
      ...(meta.id ? { id: meta.id } : {}),
      turn_id: meta.turnId ?? null,
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
