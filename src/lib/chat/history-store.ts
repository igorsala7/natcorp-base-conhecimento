import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Releitura de histórico de conversa POR IDENTIDADE (Fase 3B).
 *
 * As conversas do portal/widget já persistem em `conversations`/`messages`
 * (com `session_id` e os `p_*` de rastreio). Aqui só LEMOS a conversa mais
 * recente que casa com a identidade do visitante, para reexibir quando ele
 * volta. O "Limpar" do cliente é VISUAL: ele guarda o instante da limpeza
 * (`afterIso`) e nós filtramos as mensagens anteriores — o banco fica intacto
 * (o admin/analytics continua vendo tudo).
 */
export type HistoryCitation = {
  n: number;
  title: string;
  url: string | null;
  image?: string | null;
  heading_path?: string | null;
};
/** Metadado leve do anexo, para reexibir o "chip" no histórico. */
export type HistoryAttachment = { id: string; name: string; mime: string; size: number };
export type HistoryMessage = {
  role: "user" | "assistant";
  content: string;
  citations?: HistoryCitation[];
  feedback?: 1 | -1;
  attachments?: HistoryAttachment[];
};
export type ChatHistory = { conversationId: string; messages: HistoryMessage[] };

type Client = SupabaseClient<Database>;
/** Colunas de identidade a casar (ex.: `{p_base, p_usuario}` ou `{session_id}`). */
export type IdentityMatch = Partial<
  Record<"p_base" | "p_usuario" | "session_id" | "user_ref", string>
>;

const MAX_MESSAGES = 60;

/**
 * Histórico da conversa MAIS RECENTE que casa com `match`, naquele espaço. Só
 * mensagens criadas após `afterIso` (limpeza visual). Retorna null se não há
 * conversa ou se, após o filtro, não sobrou nada a mostrar (o cliente então
 * começa do zero).
 */
export async function fetchLatestHistory(
  supabase: Client,
  spaceId: string,
  match: IdentityMatch,
  afterIso?: string | null,
): Promise<ChatHistory | null> {
  const filtros = Object.entries(match).filter(([, v]) => !!v);
  if (!spaceId || filtros.length === 0) return null;

  let cq = supabase.from("conversations").select("id").eq("space_id", spaceId);
  for (const [col, val] of filtros) cq = cq.eq(col, val as string);
  const { data: conv } = await cq.order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!conv) return null;

  let mq = supabase
    .from("messages")
    .select("role, content, citations, feedback, attachments, created_at")
    .eq("conversation_id", conv.id)
    .order("created_at", { ascending: true })
    .limit(MAX_MESSAGES);
  if (afterIso) mq = mq.gt("created_at", afterIso);
  const { data: rows } = await mq;

  const messages: HistoryMessage[] = (rows ?? [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => {
      const cites = Array.isArray(m.citations) ? (m.citations as unknown as HistoryCitation[]) : undefined;
      const atts = Array.isArray(m.attachments) ? (m.attachments as unknown as HistoryAttachment[]) : undefined;
      return {
        role: m.role as "user" | "assistant",
        content: m.content,
        ...(cites && cites.length ? { citations: cites } : {}),
        ...(atts && atts.length ? { attachments: atts } : {}),
        ...(m.feedback === 1 || m.feedback === -1 ? { feedback: m.feedback as 1 | -1 } : {}),
      };
    });
  if (messages.length === 0) return null;
  return { conversationId: conv.id, messages };
}

/** Constrói o `match` a partir do rastreio: prioriza a identidade (p_base +
 *  p_usuario, que atravessa dispositivos); sem ela, cai na sessão do navegador. */
export function identityMatch(
  pBase: string | undefined,
  pUsuario: string | undefined,
  sessionId: string | undefined,
): IdentityMatch | null {
  if (pBase && pUsuario) return { p_base: pBase, p_usuario: pUsuario };
  if (sessionId) return { session_id: sessionId };
  return null;
}
