"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";
import { audit } from "@/lib/auth/audit";
import { enqueueBulkProcess } from "@/lib/jobs/boss";

/**
 * Enfileira o processamento em LOTE da seleção múltipla: publicar → embedding →
 * ontologia, em segundo plano, um item de cada vez (o worker orquestra a
 * prioridade e a ordem). Cada processo escolhido exige sua permissão.
 */
export async function enqueueBulkProcessJob(input: {
  spaceId: string;
  nodeIds: string[];
  publish: boolean;
  embedding: boolean;
  ontology: boolean;
}): Promise<{ ok: true; jobId: string } | { ok: false; error: string }> {
  const { spaceId, nodeIds, publish, embedding, ontology } = input;
  if (!nodeIds.length) return { ok: false, error: "Nada selecionado." };
  if (!publish && !embedding && !ontology)
    return { ok: false, error: "Escolha ao menos um processo (publicar, embedding ou ontologia)." };
  try {
    if (publish) await requirePermission("content.publish", spaceId);
    if (embedding) await requirePermission("embeddings.reindex", spaceId);
    if (ontology) await requirePermission("ai.configure", spaceId);
    // Gate da tabela (bulk_jobs) é content.publish — garante a inserção.
    await requirePermission("content.publish", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão para um dos processos escolhidos." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: job, error } = await supabase
    .from("bulk_jobs")
    .insert({
      space_id: spaceId,
      node_ids: nodeIds,
      do_publish: publish,
      do_embedding: embedding,
      do_ontology: ontology,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error || !job) return { ok: false, error: `Falha ao criar o job: ${error?.message}` };

  try {
    await enqueueBulkProcess(job.id);
  } catch {
    await supabase.from("bulk_jobs").update({ status: "error", error: "Fila indisponível" }).eq("id", job.id);
    return { ok: false, error: "Fila indisponível — o worker precisa estar rodando (npm run worker)." };
  }

  await audit({
    action: "content.bulk_process",
    entityType: "space",
    entityId: spaceId,
    spaceId,
    after: { nodes: nodeIds.length, publish, embedding, ontology },
  });
  revalidatePath("/admin/conteudo");
  return { ok: true, jobId: job.id };
}
