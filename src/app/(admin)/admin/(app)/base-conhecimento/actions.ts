"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";
import { audit } from "@/lib/auth/audit";
import { extractDocument } from "@/lib/importer/extract";
import { reindexDocumentChunks } from "@/lib/content/chunk";
import { MAX_BYTES, MAX_MB } from "./constants";

export type KbResult = { ok: true } | { ok: false; error: string };

/**
 * Registra o arquivo já enviado ao Storage e processa AGORA.
 *
 * Diferente da importação de documentos (que vira árvore e roda em worker por
 * ser longa), aqui o trabalho é extrair + fatiar + vetorizar um arquivo só.
 * Manter no request evita exigir o worker de pé para a base funcionar — e o
 * upload já tem teto de tamanho.
 */
export async function ingestKnowledgeFile(input: {
  spaceId: string;
  storagePath: string;
  originalName: string;
  mime: string;
  sizeBytes: number;
}): Promise<KbResult> {
  const { spaceId, storagePath, originalName, mime, sizeBytes } = input;
  try {
    await requirePermission("content.edit", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão para editar esta documentação." };
  }
  if (sizeBytes > MAX_BYTES) {
    return { ok: false, error: `Arquivo maior que ${MAX_MB} MB.` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: doc, error } = await supabase
    .from("knowledge_documents")
    .insert({
      space_id: spaceId,
      storage_path: storagePath,
      original_name: originalName,
      mime,
      size_bytes: sizeBytes,
      status: "extracting",
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error || !doc) return { ok: false, error: `Falha ao registrar: ${error?.message}` };

  try {
    const { data: blob, error: dl } = await supabase.storage.from("imports").download(storagePath);
    if (dl || !blob) throw new Error(dl?.message ?? "Arquivo não encontrado no Storage.");

    const buf = Buffer.from(await blob.arrayBuffer());
    const { blocks } = await extractDocument(buf, originalName, mime);
    const count = await reindexDocumentChunks(supabase, {
      documentId: doc.id,
      spaceId,
      blocks,
      withEmbeddings: true,
    });

    if (count === 0) {
      // "Pronto com zero trechos" seria mentira: o chatbot não ganharia nada.
      await supabase
        .from("knowledge_documents")
        .update({ status: "error", error: "Nenhum texto extraível no arquivo." })
        .eq("id", doc.id);
      return { ok: false, error: "Não foi possível extrair texto deste arquivo." };
    }

    await supabase
      .from("knowledge_documents")
      .update({ status: "ready", chunk_count: count, error: null })
      .eq("id", doc.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase
      .from("knowledge_documents")
      .update({ status: "error", error: msg.slice(0, 400) })
      .eq("id", doc.id);
    return { ok: false, error: `Falha ao processar: ${msg}` };
  }

  await audit({
    action: "content.create",
    entityType: "knowledge_document",
    entityId: doc.id,
    spaceId,
    after: { original_name: originalName },
  });
  revalidatePath("/admin/base-conhecimento");
  return { ok: true };
}

/** Remove o documento, seus chunks (cascade) e o arquivo do Storage. */
export async function deleteKnowledgeFile(id: string): Promise<KbResult> {
  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("knowledge_documents")
    .select("space_id, storage_path, original_name")
    .eq("id", id)
    .maybeSingle();
  if (!doc) return { ok: false, error: "Documento não encontrado." };

  try {
    await requirePermission("content.edit", doc.space_id);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }

  // Os chunks somem por ON DELETE CASCADE.
  const { error } = await supabase.from("knowledge_documents").delete().eq("id", id);
  if (error) return { ok: false, error: `Falha ao excluir: ${error.message}` };
  // Best-effort: um arquivo órfão no Storage é menos grave do que falhar aqui.
  await supabase.storage.from("imports").remove([doc.storage_path]);

  await audit({
    action: "content.delete",
    entityType: "knowledge_document",
    entityId: id,
    spaceId: doc.space_id,
    before: { original_name: doc.original_name },
  });
  revalidatePath("/admin/base-conhecimento");
  return { ok: true };
}
