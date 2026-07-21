"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";
import { audit } from "@/lib/auth/audit";
import { reindexNodeChunks } from "@/lib/content/chunk";
import type { Json } from "@/lib/database.types";

export type VersionResult = { ok: true } | { ok: false; error: string };

export type ArticleVersion = {
  id: string;
  version: number;
  label: string | null;
  protected: boolean;
  created_at: string;
  author: string | null;
};

async function spaceIdOfNode(
  supabase: Awaited<ReturnType<typeof createClient>>,
  nodeId: string,
): Promise<string | null> {
  const { data } = await supabase.from("nodes").select("space_id").eq("id", nodeId).single();
  return data?.space_id ?? null;
}

/** Lista o histórico de versões do artigo (mais recente primeiro). */
export async function listArticleVersions(nodeId: string): Promise<ArticleVersion[]> {
  const supabase = await createClient();
  const { data: art } = await supabase
    .from("articles")
    .select("id")
    .eq("node_id", nodeId)
    .maybeSingle();
  if (!art) return [];
  const { data } = await supabase
    .from("article_versions")
    .select("id, version, label, protected, created_at, created_by")
    .eq("article_id", art.id)
    .order("version", { ascending: false });
  const rows = data ?? [];

  // Nomes dos autores (created_by → profiles).
  const ids = [...new Set(rows.map((r) => r.created_by).filter(Boolean))] as string[];
  const nameById = new Map<string, string>();
  if (ids.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", ids);
    for (const p of profs ?? []) nameById.set(p.id, p.full_name ?? p.email ?? "—");
  }

  return rows.map((r) => ({
    id: r.id,
    version: r.version,
    label: r.label,
    protected: r.protected,
    created_at: r.created_at,
    author: r.created_by ? (nameById.get(r.created_by) ?? null) : null,
  }));
}

/** Conteúdo de uma versão (para visualizar/comparar). */
export async function getArticleVersion(
  versionId: string,
): Promise<{ ok: true; content: object; text: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("article_versions")
    .select("content_json, content_text")
    .eq("id", versionId)
    .maybeSingle();
  if (!data) return { ok: false, error: "Versão não encontrada." };
  return {
    ok: true,
    content: (data.content_json as object) ?? { type: "doc", content: [] },
    text: data.content_text ?? "",
  };
}

/** Cria uma versão nomeada do estado atual (opcionalmente protegida). */
export async function snapshotArticleVersion(
  nodeId: string,
  label: string,
  isProtected: boolean,
): Promise<VersionResult> {
  const supabase = await createClient();
  const spaceId = await spaceIdOfNode(supabase, nodeId);
  if (!spaceId) return { ok: false, error: "Nó não encontrado." };
  try {
    await requirePermission("content.edit", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }
  const { error } = await supabase.rpc("create_article_version", {
    p_node_id: nodeId,
    p_label: label.trim() || undefined,
    p_protected: isProtected,
  });
  if (error) return { ok: false, error: `Falha: ${error.message}` };
  await audit({ action: "content.version_create", entityType: "node", entityId: nodeId, spaceId, after: { label } });
  revalidatePath(`/admin/conteudo/${nodeId}`);
  return { ok: true };
}

/** Renomeia / (des)protege uma versão. */
export async function renameArticleVersion(
  versionId: string,
  label: string,
  isProtected: boolean,
): Promise<VersionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("rename_article_version", {
    p_version_id: versionId,
    p_label: label.trim(),
    p_protected: isProtected,
  });
  if (error) {
    return {
      ok: false,
      error: error.message.includes("permiss") ? "Sem permissão." : `Falha: ${error.message}`,
    };
  }
  await audit({ action: "content.version_rename", entityType: "article_version", entityId: versionId });
  return { ok: true };
}

/**
 * Restaura uma versão SEM sobrescrever o histórico (append-only): guarda o
 * estado atual como versão, aplica o conteúdo da versão escolhida e registra
 * uma nova versão "Restaurado da vX". Exige content.restore (nível 60+).
 */
export async function restoreArticleVersion(
  nodeId: string,
  versionId: string,
): Promise<VersionResult> {
  const supabase = await createClient();
  const spaceId = await spaceIdOfNode(supabase, nodeId);
  if (!spaceId) return { ok: false, error: "Nó não encontrado." };
  try {
    await requirePermission("content.restore", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão para restaurar (precisa nível 60+)." };
  }

  const { data: target } = await supabase
    .from("article_versions")
    .select("version, content_json, content_text")
    .eq("id", versionId)
    .maybeSingle();
  if (!target) return { ok: false, error: "Versão não encontrada." };

  const { data: art } = await supabase
    .from("articles")
    .select("id")
    .eq("node_id", nodeId)
    .maybeSingle();
  if (!art) return { ok: false, error: "Artigo não encontrado." };

  // 1) Preserva o estado atual antes de sobrescrever.
  await supabase.rpc("create_article_version", { p_node_id: nodeId, p_label: "Antes de restaurar" });
  // 2) Aplica o conteúdo da versão escolhida.
  await supabase
    .from("articles")
    .update({
      content_json: target.content_json as Json,
      content_text: target.content_text,
      updated_at: new Date().toISOString(),
    })
    .eq("id", art.id);
  // 3) Registra a restauração como nova versão.
  await supabase.rpc("create_article_version", {
    p_node_id: nodeId,
    p_label: `Restaurado da v${target.version}`,
  });
  // 4) Reindexa a busca. Com embeddings: sem isso o chatbot seguiria
  // respondendo o conteúdo anterior até a próxima publicação.
  await reindexNodeChunks(supabase, {
    nodeId,
    articleId: art.id,
    spaceId,
    doc: target.content_json as { type: string; content?: never[] },
    withEmbeddings: true,
  });

  await audit({
    action: "content.restore_version",
    entityType: "node",
    entityId: nodeId,
    spaceId,
    after: { from_version: target.version },
  });
  revalidatePath(`/admin/conteudo/${nodeId}`);
  return { ok: true };
}
