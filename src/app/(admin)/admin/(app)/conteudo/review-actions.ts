"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit } from "@/lib/auth/audit";
import { reindexNodeChunks } from "@/lib/content/chunk";

export type ReviewResult = { ok: true } | { ok: false; error: string };

export type ReviewComment = {
  id: string;
  kind: "comment" | "approve" | "reject" | "submit";
  body: string | null;
  created_at: string;
  author: string | null;
};

export type ReviewItem = {
  id: string;
  title: string;
  space_id: string;
  spaceName: string;
  updated_at: string;
};

function mapErr(msg: string): string {
  return msg.includes("permiss") ? "Sem permissão." : `Falha: ${msg}`;
}

/** Editor envia o rascunho para revisão (status → review). */
export async function submitForReview(nodeId: string): Promise<ReviewResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_for_review", { p_node_id: nodeId });
  if (error) return { ok: false, error: mapErr(error.message) };
  await audit({ action: "review.submit", entityType: "node", entityId: nodeId });
  revalidatePath("/admin/revisao");
  revalidatePath(`/admin/conteudo/${nodeId}`);
  return { ok: true };
}

/** Revisor aprova: publica + snapshot; reindexa embeddings (via service-role). */
export async function approveReview(nodeId: string): Promise<ReviewResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_review", { p_node_id: nodeId });
  if (error) return { ok: false, error: mapErr(error.message) };

  // Reindex mecânico (o revisor não tem content.edit; usa service-role).
  const admin = createAdminClient();
  const { data: node } = await admin.from("nodes").select("space_id").eq("id", nodeId).single();
  const { data: art } = await admin
    .from("articles")
    .select("id, content_json")
    .eq("node_id", nodeId)
    .maybeSingle();
  if (node && art) {
    await reindexNodeChunks(admin, {
      nodeId,
      articleId: art.id,
      spaceId: node.space_id,
      doc: art.content_json as { type: string; content?: never[] },
      withEmbeddings: true,
    });
  }
  await audit({ action: "review.approve", entityType: "node", entityId: nodeId, spaceId: node?.space_id });
  revalidatePath("/admin/revisao");
  revalidatePath(`/admin/conteudo/${nodeId}`);
  revalidatePath("/admin/conteudo");
  return { ok: true };
}

/** Revisor rejeita: volta a rascunho + comentário obrigatório. */
export async function rejectReview(nodeId: string, comment: string): Promise<ReviewResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_review", {
    p_node_id: nodeId,
    p_comment: comment.trim() || "Sem comentário.",
  });
  if (error) return { ok: false, error: mapErr(error.message) };
  await audit({ action: "review.reject", entityType: "node", entityId: nodeId, after: { comment } });
  revalidatePath("/admin/revisao");
  revalidatePath(`/admin/conteudo/${nodeId}`);
  return { ok: true };
}

/** Adiciona um comentário no fluxo de revisão (Editor/Revisor). */
export async function addReviewComment(nodeId: string, body: string): Promise<ReviewResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("review_comments")
    .insert({ node_id: nodeId, author_id: user?.id ?? null, kind: "comment", body: body.trim() });
  if (error) return { ok: false, error: mapErr(error.message) };
  revalidatePath(`/admin/conteudo/${nodeId}`);
  return { ok: true };
}

/** Lista comentários/eventos de revisão de um nó (mais antigos primeiro). */
export async function listReviewComments(nodeId: string): Promise<ReviewComment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("review_comments")
    .select("id, kind, body, created_at, author_id")
    .eq("node_id", nodeId)
    .order("created_at", { ascending: true });
  const rows = data ?? [];
  const ids = [...new Set(rows.map((r) => r.author_id).filter(Boolean))] as string[];
  const nameById = new Map<string, string>();
  if (ids.length) {
    const { data: profs } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
    for (const p of profs ?? []) nameById.set(p.id, p.full_name ?? p.email ?? "—");
  }
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind as ReviewComment["kind"],
    body: r.body,
    created_at: r.created_at,
    author: r.author_id ? (nameById.get(r.author_id) ?? null) : null,
  }));
}

/** Fila de revisão: nós com status 'review'. */
export async function listReviewQueue(): Promise<ReviewItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("nodes")
    .select("id, title, space_id, updated_at")
    .eq("status", "review")
    .is("deleted_at", null)
    .order("updated_at", { ascending: true });
  const rows = data ?? [];
  const { data: spaces } = await supabase.from("spaces").select("id, name");
  const nameById = new Map((spaces ?? []).map((s) => [s.id, s.name]));
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    space_id: r.space_id,
    spaceName: nameById.get(r.space_id) ?? "?",
    updated_at: r.updated_at,
  }));
}
