"use server";

import { cookies } from "next/headers";
import { createPublicClient } from "@/lib/supabase/public";
import {
  resolvePortalSpace,
  getPortalAccess,
  getPortalTree,
  flattenPortalTree,
} from "@/lib/portal/data";
import { slugify } from "@/lib/content/slug";
import { originCookieName } from "@/lib/portal/origin-gate";
import {
  spaceCookieName,
  makeSpaceToken,
  verifySpaceToken,
  SPACE_COOKIE_MAX_AGE,
} from "@/lib/portal/space-auth";
import { portalRateLimitOk } from "@/lib/portal/rate-limit";
import { decodeTrackForSpace } from "@/lib/tracking/resolve";
import {
  listClientePrompts,
  saveClientePrompt,
  deleteClientePrompt,
  type SavedPrompt,
  type SavePromptResult,
  type ClienteIdentity,
} from "@/lib/portal/prompt-store";
import { fetchLatestHistory, identityMatch, type ChatHistory } from "@/lib/chat/history-store";
import { receiveAttachment, type AttachmentMeta } from "@/lib/chat/attachment-store";

/**
 * Conta uma visualização de artigo (visitante anônimo).
 *
 * A validação de "artigo publicado de espaço alcançável" está DENTRO da RPC
 * (`register_article_view`, SECURITY DEFINER); aqui só o rate limit por IP.
 * Dedupe por sessão é no navegador — honesto o bastante para "mais vistos",
 * sem cookie de rastreio.
 */
export async function registerView(nodeId: string): Promise<{ ok: boolean }> {
  if (!nodeId) return { ok: false };
  if (!(await portalRateLimitOk("view", 60))) return { ok: false };
  const supabase = createPublicClient();
  const { error } = await supabase.rpc("register_article_view", { p_node_id: nodeId });
  return { ok: !error };
}

/** Registra feedback "Isso foi útil?" (visitante anônimo). */
export async function submitFeedback(
  nodeId: string,
  helpful: boolean,
  comment?: string,
): Promise<{ ok: boolean }> {
  if (!(await portalRateLimitOk("feedback", 20))) return { ok: false };
  const supabase = createPublicClient();
  const { error } = await supabase
    .from("article_feedback")
    .insert({ node_id: nodeId, helpful, comment: comment?.trim() || null });
  return { ok: !error };
}

/**
 * Feedback 👍/👎 na última resposta do Ask-AI do portal.
 *
 * Roda com service-role, então o escopo é checado AQUI — igual a
 * /api/v1/feedback já fazia. Antes bastava um conversationId qualquer para
 * envenenar o feedback de conversas de outros espaços, ou até do admin.
 * A conversa tem que ser deste espaço E desta sessão do navegador.
 */
export async function submitPortalChatFeedback(
  conversationId: string,
  value: 1 | -1,
  spaceSlug: string,
  sessionId: string,
): Promise<{ ok: boolean }> {
  if (!conversationId || !spaceSlug || !sessionId) return { ok: false };
  if (!(await portalRateLimitOk("chat-feedback", 30))) return { ok: false };

  const space = await resolvePortalSpace(spaceSlug);
  if (!space) return { ok: false };

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();

  const { data: conv } = await supabase
    .from("conversations")
    .select("id, space_id, session_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv || conv.space_id !== space.id || conv.session_id !== sessionId) {
    return { ok: false };
  }

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

export type PortalHit = {
  node_id: string;
  title: string;
  heading_path: string | null;
  snippet: string;
  url: string;
};

/**
 * Busca no portal, escopada ao espaço (respeita herança de espaço-cliente e
 * conteúdo publicado). Só lexical + trigram (rápido, tolerante a erro de
 * digitação; sem custo de embedding por tecla). Registra em search_logs.
 */
export async function searchPortal(
  spaceSlug: string,
  query: string,
): Promise<PortalHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  // Teto generoso: a busca dispara a cada 150ms de digitação, então o limite
  // precisa caber num uso legítimo intenso e ainda barrar script.
  if (!(await portalRateLimitOk("search", 120))) return [];
  const access = await getPortalAccess(spaceSlug);
  if (!access || access.locked) return [];
  const { space, db } = access;

  const tree = await getPortalTree(space.id, db);
  const flat = flattenPortalTree(tree).filter(
    (n) => n.type === "article" || n.type === "folder",
  );
  const nodeIds = flat.map((n) => n.id);
  const slugById = new Map(flat.map((n) => [n.id, n.slugPath]));
  if (nodeIds.length === 0) return [];

  const { data, error } = await db.rpc("hybrid_search_scoped", {
    p_query: q,
    p_node_ids: nodeIds,
    p_limit: 12,
  });
  // Erro engolido aqui já escondeu uma queda total da busca (permission
  // denied virava "sem resultados") — o log é o que denuncia a diferença.
  if (error) console.error("[searchPortal] hybrid_search_scoped falhou:", error.message);
  // A busca do portal é só de artigos: passa `p_node_ids` e a RLS do `anon`
  // exige nó publicado. O filtro abaixo é a terceira barreira — se um chunk de
  // arquivo chegasse aqui, viraria um resultado sem link para o leitor.
  const rows = (data ?? []).filter((r): r is typeof r & { node_id: string } => !!r.node_id);

  // Loga a busca (alimenta as Análises de lacunas). Best-effort.
  //
  // `origin` explícito, apesar de ser o default da coluna: é aqui que a métrica
  // de lacuna de documentação de fato nasce, e deixar isso implícito convidaria
  // a próxima origem a esquecer de se declarar.
  //
  // Continua gravando por TECLA — a busca dispara a cada 150ms. Diferente do
  // admin, aqui o ruído não é corrigível só no servidor: exige o cliente avisar
  // quando o leitor abriu um resultado ou desistiu. Fica para a rodada do portal.
  await db.from("search_logs").insert({
    origin: "portal",
    query: q,
    results_count: rows.length,
    space_id: space.id,
  });

  return rows.map((r) => {
    const slugPath = slugById.get(r.node_id) ?? [];
    const anchor = r.heading_path
      ? "#" + slugify(r.heading_path.split(" > ").pop() ?? "")
      : "";
    return {
      node_id: r.node_id,
      title: r.title,
      heading_path: r.heading_path,
      snippet: r.snippet ?? "",
      url: `/docs/${space.slug}/${slugPath.join("/")}${anchor}`,
    };
  });
}

/**
 * Prompts salvos do leitor no portal (biblioteca de reuso do Ask-AI).
 *
 * Identidade = par (p_base, p_usuario) que veio no TOKEN cifrado da visita — só
 * existe biblioteca quando ambos estão presentes. O token é decifrado com a
 * chave do espaço (`decodeTrackForSpace`); ninguém forja p_usuario no console.
 * A tabela é service-role (RLS nega o cliente), então o escopo é imposto AQUI.
 */
async function resolvePromptScope(
  spaceSlug: string,
  track: unknown,
): Promise<{ spaceId: string; identity: ClienteIdentity } | null> {
  const space = await resolvePortalSpace(spaceSlug);
  if (!space) return null;
  const t = await decodeTrackForSpace(space.id, track);
  if (!t.p_base || !t.p_usuario) return null;
  return { spaceId: space.id, identity: { p_base: t.p_base, p_usuario: t.p_usuario } };
}

export async function listPortalPrompts(
  spaceSlug: string,
  track: unknown,
): Promise<SavedPrompt[]> {
  const scope = await resolvePromptScope(spaceSlug, track);
  if (!scope) return [];
  return listClientePrompts(scope.spaceId, scope.identity);
}

export async function savePortalPrompt(
  spaceSlug: string,
  track: unknown,
  input: { id?: string | null; label?: string | null; texto: string },
): Promise<SavePromptResult> {
  if (!(await portalRateLimitOk("prompt-save", 40))) {
    return { ok: false, error: "Muitas ações. Aguarde um instante." };
  }
  const scope = await resolvePromptScope(spaceSlug, track);
  if (!scope) return { ok: false, error: "Sem identidade de visitante para salvar prompts." };
  return saveClientePrompt(scope.spaceId, scope.identity, input);
}

export async function deletePortalPrompt(
  spaceSlug: string,
  track: unknown,
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const scope = await resolvePromptScope(spaceSlug, track);
  if (!scope) return { ok: false, error: "Sem identidade de visitante." };
  return deleteClientePrompt(scope.spaceId, scope.identity, id);
}

/**
 * Histórico do Ask-AI do portal, relido por identidade (Fase 3B). Casa pela
 * identidade (p_base + p_usuario) e, sem ela, pela sessão do navegador. Só
 * mensagens após `afterIso` (o "Limpar" do leitor grava esse instante — a
 * limpeza é visual, o banco fica intacto). Roda com service-role, escopado ao
 * espaço aqui.
 */
export async function getPortalChatHistory(
  spaceSlug: string,
  sessionId: string,
  track: unknown,
  afterIso?: string | null,
): Promise<ChatHistory | null> {
  if (!(await portalRateLimitOk("chat-history", 40))) return null;
  const space = await resolvePortalSpace(spaceSlug);
  if (!space) return null;
  const t = await decodeTrackForSpace(space.id, track);
  const match = identityMatch(t.p_base, t.p_usuario, sessionId || undefined);
  if (!match) return null;
  const { createAdminClient } = await import("@/lib/supabase/admin");
  return fetchLatestHistory(createAdminClient(), space.id, match, afterIso);
}

/**
 * Anexa um documento ao Ask-AI do portal (Fase 3C). Mesma origem (sem chave);
 * escopo = o espaço do slug. Valida, guarda e extrai o texto; devolve os
 * metadados (o id volta no `attachmentIds` do /api/portal/chat).
 */
export async function uploadPortalAttachment(
  spaceSlug: string,
  formData: FormData,
): Promise<{ ok: true; attachment: AttachmentMeta } | { ok: false; error: string }> {
  if (!(await portalRateLimitOk("attach", 15))) {
    return { ok: false, error: "Muitos envios. Aguarde um instante." };
  }
  const space = await resolvePortalSpace(spaceSlug);
  if (!space) return { ok: false, error: "Espaço não encontrado." };
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Arquivo ausente." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  return receiveAttachment(space.id, { name: file.name, mime: file.type, bytes });
}

/**
 * Verifica a senha de um espaço protegido. Em caso de sucesso, grava um cookie
 * assinado (o conteúdo só é servido via service-role depois deste cookie).
 */
export async function verifySpacePassword(
  spaceSlug: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  const space = await resolvePortalSpace(spaceSlug);
  if (!space || space.visibility !== "password") {
    return { ok: false, error: "Espaço não encontrado." };
  }
  const supabase = createPublicClient();
  const { data: valid, error } = await supabase.rpc("verify_space_password", {
    p_space_id: space.id,
    p_plain: password,
  });
  // O teto de tentativas vive na própria RPC (ela é chamável direto no
  // PostgREST); aqui só traduzimos para uma mensagem honesta em vez de deixar
  // "Senha incorreta" mentir sobre o motivo.
  if (error) {
    const excedeu = error.message.includes("Muitas tentativas");
    return {
      ok: false,
      error: excedeu
        ? "Muitas tentativas. Aguarde um minuto e tente de novo."
        : "Não foi possível verificar a senha.",
    };
  }
  if (valid !== true) return { ok: false, error: "Senha incorreta." };

  const store = await cookies();
  store.set(spaceCookieName(space.id), makeSpaceToken(space.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SPACE_COOKIE_MAX_AGE,
  });
  return { ok: true };
}

/**
 * Persiste a liberação por ORIGEM: a página validou o Referer e emitiu um
 * token assinado; aqui só conferimos a assinatura e gravamos o cookie — o
 * cliente nunca fabrica um token válido sem o segredo do servidor.
 */
export async function persistOriginCookie(
  spaceSlug: string,
  token: string,
): Promise<{ ok: boolean }> {
  const space = await resolvePortalSpace(spaceSlug);
  if (!space || !verifySpaceToken(space.id, token)) return { ok: false };
  const store = await cookies();
  store.set(originCookieName(space.id), makeSpaceToken(space.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SPACE_COOKIE_MAX_AGE,
  });
  return { ok: true };
}
