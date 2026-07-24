"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";
import { audit } from "@/lib/auth/audit";
import { enqueueEmbeddings } from "@/lib/jobs/boss";
import { deleteKnowledgeFile } from "../base-conhecimento/actions";

/** Uma linha do relatório de gestão de embeddings (origem = artigo OU arquivo). */
export type EmbeddingReportRow = {
  originKind: "article" | "file";
  originId: string;
  title: string;
  spaceId: string;
  spaceName: string;
  chunkCount: number;
  embeddedCount: number;
  provider: string | null;
  model: string | null;
  embeddedAt: string | null;
  userName: string | null;
  status: string | null;
};

/**
 * Relatório unificado (artigos + arquivos): data, usuário, onde é usado
 * (documentação) e provedor/modelo que gerou cada vetor. A RPC já respeita a
 * RLS — o usuário só vê o que pode ver.
 */
export async function listEmbeddingsReport(spaceId?: string): Promise<EmbeddingReportRow[]> {
  await requirePermission("embeddings.reindex", spaceId);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("embeddings_report", {
    p_space_id: spaceId ?? null,
  });
  if (error || !data) return [];

  // Nomes dos usuários numa consulta só (ids distintos).
  const ids = [...new Set(data.map((r) => r.embedded_by).filter((x): x is string => !!x))];
  const nomes = new Map<string, string>();
  if (ids.length) {
    const { data: perfis } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", ids);
    for (const p of perfis ?? []) nomes.set(p.id, p.full_name || p.email || "—");
  }

  return data
    .map((r) => ({
      originKind: (r.origin_kind === "file" ? "file" : "article") as "article" | "file",
      originId: r.origin_id,
      title: r.title ?? "(sem título)",
      spaceId: r.space_id,
      spaceName: r.space_name,
      chunkCount: Number(r.chunk_count),
      embeddedCount: Number(r.embedded_count),
      provider: r.provider,
      model: r.model,
      embeddedAt: r.embedded_at,
      userName: r.embedded_by ? (nomes.get(r.embedded_by) ?? null) : null,
      status: r.status,
    }))
    .sort((a, b) => (a.embeddedAt && b.embeddedAt ? (a.embeddedAt < b.embeddedAt ? 1 : -1) : a.embeddedAt ? -1 : 1));
}

/** Pastas + artigos de uma documentação (para o seletor de origem da geração). */
export async function listSpaceNodes(
  spaceId: string,
): Promise<{ id: string; title: string; type: string; depth: number }[]> {
  try {
    await requirePermission("content.view", spaceId);
  } catch {
    return [];
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("nodes")
    .select("id, parent_id, title, type, position")
    .eq("space_id", spaceId)
    .in("type", ["folder", "article"])
    .is("deleted_at", null)
    .order("position");

  const rows = data ?? [];
  const byParent = new Map<string | null, typeof rows>();
  for (const n of rows) {
    const list = byParent.get(n.parent_id) ?? [];
    list.push(n);
    byParent.set(n.parent_id, list);
  }
  const out: { id: string; title: string; type: string; depth: number }[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const n of byParent.get(parent) ?? []) {
      out.push({ id: n.id, title: n.title, type: n.type, depth });
      walk(n.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/**
 * Enfileira a GERAÇÃO de embeddings em segundo plano (worker), com progresso
 * via `embedding_jobs`. Escopo: sem nó = documentação inteira; pasta = subárvore;
 * artigo = só ele. O upload de arquivo continua síncrono (ingestKnowledgeFile).
 */
export async function enqueueEmbeddingsJob(input: {
  spaceId: string;
  nodeId?: string;
  nodeType?: string;
}): Promise<{ ok: true; jobId: string } | { ok: false; error: string }> {
  const { spaceId, nodeId, nodeType } = input;
  try {
    await requirePermission("embeddings.reindex", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }
  const scope = !nodeId ? "space" : nodeType === "folder" ? "subtree" : "article";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: job, error } = await supabase
    .from("embedding_jobs")
    .insert({ space_id: spaceId, scope, target_id: nodeId ?? null, created_by: user?.id ?? null })
    .select("id")
    .single();
  if (error || !job) return { ok: false, error: `Falha ao criar o job: ${error?.message}` };

  try {
    await enqueueEmbeddings(job.id);
  } catch {
    await supabase
      .from("embedding_jobs")
      .update({ status: "error", error: "Fila indisponível" })
      .eq("id", job.id);
    return { ok: false, error: "Fila indisponível — o worker precisa estar rodando (npm run worker)." };
  }

  await audit({
    action: "embeddings.generate",
    entityType: scope === "space" ? "space" : "node",
    entityId: nodeId ?? spaceId,
    spaceId,
    after: { scope },
  });
  revalidatePath("/admin/importar");
  return { ok: true, jobId: job.id };
}

export type EmbResult = { ok: true } | { ok: false; error: string };

/**
 * Apaga os embeddings de uma origem.
 *  - Arquivo: exclui o documento (existe só para o chat) — chunks caem em cascade.
 *  - Artigo: ZERA os vetores (embedding=null) mantendo os chunks para a busca
 *    léxica; são regerados na próxima publicação. Apagar o artigo em si é outra
 *    ação (na árvore/lixeira).
 */
export async function deleteEmbeddingsOrigin(input: {
  kind: "article" | "file";
  id: string;
}): Promise<EmbResult> {
  if (input.kind === "file") return deleteKnowledgeFile(input.id);

  const supabase = await createClient();
  const { data: node } = await supabase
    .from("nodes")
    .select("space_id, title")
    .eq("id", input.id)
    .maybeSingle();
  if (!node) return { ok: false, error: "Artigo não encontrado." };
  try {
    await requirePermission("embeddings.reindex", node.space_id);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }

  const { error } = await supabase
    .from("chunks")
    .update({
      embedding: null,
      embedding_provider: null,
      embedding_model: null,
      embedded_at: null,
      embedded_by: null,
    })
    .eq("node_id", input.id);
  if (error) return { ok: false, error: `Falha ao apagar: ${error.message}` };

  await audit({
    action: "embeddings.delete",
    entityType: "node",
    entityId: input.id,
    spaceId: node.space_id,
    before: { title: node.title },
  });
  revalidatePath("/admin/importar");
  return { ok: true };
}
