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
import {
  spaceCookieName,
  makeSpaceToken,
  SPACE_COOKIE_MAX_AGE,
} from "@/lib/portal/space-auth";
import { portalRateLimitOk } from "@/lib/portal/rate-limit";

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

  const { data } = await db.rpc("hybrid_search_scoped", {
    p_query: q,
    p_node_ids: nodeIds,
    p_limit: 12,
  });
  // A busca do portal é só de artigos: passa `p_node_ids` e a RLS do `anon`
  // exige nó publicado. O filtro abaixo é a terceira barreira — se um chunk de
  // arquivo chegasse aqui, viraria um resultado sem link para o leitor.
  const rows = (data ?? []).filter((r): r is typeof r & { node_id: string } => !!r.node_id);

  // Loga a busca (alimenta as Análises de lacunas). Best-effort.
  await db.from("search_logs").insert({
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
