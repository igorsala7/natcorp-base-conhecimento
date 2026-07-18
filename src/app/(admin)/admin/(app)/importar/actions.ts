"use server";

import { revalidatePath } from "next/cache";
import { generateKeyBetween } from "fractional-indexing";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";
import { audit } from "@/lib/auth/audit";
import { slugify } from "@/lib/content/slug";
import { enqueueImport } from "@/lib/jobs/boss";
import type { ProposedNode, ContentItem } from "@/lib/importer/structure";
import type { Json } from "@/lib/database.types";

export type ImportResult = { ok: true; id?: string } | { ok: false; error: string };

/** Cria o job de importação (arquivo já subido ao bucket) e enfileira. */
export async function createImportJob(input: {
  spaceId: string;
  sourceFile: string;
  originalName: string;
  mime: string;
  sizeBytes: number;
  targetParentId?: string | null;
}): Promise<ImportResult> {
  try {
    await requirePermission("content.import", input.spaceId);
  } catch {
    return { ok: false, error: "Sem permissão para importar." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: job, error } = await supabase
    .from("import_jobs")
    .insert({
      space_id: input.spaceId,
      source_file: input.sourceFile,
      original_name: input.originalName,
      mime: input.mime,
      size_bytes: input.sizeBytes,
      target_parent_id: input.targetParentId ?? null,
      created_by: user?.id ?? null,
      status: "queued",
    })
    .select("id")
    .single();
  if (error || !job) return { ok: false, error: `Falha: ${error?.message}` };

  try {
    await enqueueImport(job.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase
      .from("import_jobs")
      .update({ status: "error", error: `Fila indisponível: ${msg}` })
      .eq("id", job.id);
    return { ok: false, error: `Fila indisponível (worker rodando?): ${msg}` };
  }

  await audit({ action: "content.import_start", entityType: "import_job", entityId: job.id, spaceId: input.spaceId });
  revalidatePath("/admin/importar");
  return { ok: true, id: job.id };
}

/** Converte os itens de conteúdo em um documento TipTap. */
function toTipTap(content: ContentItem[], images: string[]) {
  const nodes = content.map((c) =>
    c.type === "p"
      ? { type: "paragraph", content: [{ type: "text", text: c.text }] }
      : {
          type: "figureImage",
          attrs: { src: images[c.image] ?? "", alt: "", caption: "" },
        },
  );
  return { type: "doc", content: nodes.length ? nodes : [{ type: "paragraph" }] };
}

async function insertProposed(
  supabase: Awaited<ReturnType<typeof createClient>>,
  spaceId: string,
  parentId: string | null,
  node: ProposedNode,
  images: string[],
  prevPos: string | null,
): Promise<string> {
  const isFolder = node.children.length > 0;
  const type = isFolder ? "folder" : "article";
  const position = generateKeyBetween(prevPos, null);
  const slug = slugify(node.title);

  const { data: created, error } = await supabase
    .from("nodes")
    .insert({
      space_id: spaceId,
      parent_id: parentId,
      type,
      title: node.title || "Sem título",
      slug: `${slug}-${Math.random().toString(36).slice(2, 6)}`,
      position,
    })
    .select("id")
    .single();
  if (error || !created) throw new Error(error?.message ?? "insert falhou");

  if (!isFolder) {
    await supabase.from("articles").insert({
      node_id: created.id,
      content_json: toTipTap(node.content, images) as Json,
    });
  } else if (node.content.length > 0) {
    // Pasta com corpo → cria um artigo "Visão geral" com o corpo.
    await insertProposed(
      supabase,
      spaceId,
      created.id,
      { title: "Visão geral", content: node.content, children: [] },
      images,
      null,
    );
  }

  // Filhos.
  let childPrev: string | null = node.content.length > 0 ? generateKeyBetween(null, null) : null;
  for (const child of node.children) {
    childPrev = await insertProposed(supabase, spaceId, created.id, child, images, childPrev);
  }

  return position;
}

/** Materializa a árvore proposta (possivelmente editada) na árvore real. */
export async function materializeImport(
  jobId: string,
  editedTree?: ProposedNode[],
): Promise<ImportResult> {
  const supabase = await createClient();
  const { data: job } = await supabase
    .from("import_jobs")
    .select("space_id, target_parent_id, result_tree, status")
    .eq("id", jobId)
    .single();
  if (!job) return { ok: false, error: "Job não encontrado." };
  try {
    await requirePermission("content.import", job.space_id);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }

  const stored = job.result_tree as { tree: ProposedNode[]; images: string[] } | null;
  const tree = editedTree ?? stored?.tree ?? [];
  const images = stored?.images ?? [];
  if (tree.length === 0) return { ok: false, error: "Nada a importar." };

  await supabase.from("import_jobs").update({ status: "importing" }).eq("id", jobId);

  try {
    // posição inicial = fim da lista de irmãos no destino
    let q = supabase
      .from("nodes")
      .select("position")
      .eq("space_id", job.space_id)
      .is("deleted_at", null)
      .order("position", { ascending: false })
      .limit(1);
    q = job.target_parent_id
      ? q.eq("parent_id", job.target_parent_id)
      : q.is("parent_id", null);
    const { data: last } = await q.maybeSingle();
    let prev: string | null = last?.position ?? null;

    for (const node of tree) {
      prev = await insertProposed(
        supabase,
        job.space_id,
        job.target_parent_id,
        node,
        images,
        prev,
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase.from("import_jobs").update({ status: "error", error: msg }).eq("id", jobId);
    return { ok: false, error: `Falha ao materializar: ${msg}` };
  }

  await supabase.from("import_jobs").update({ status: "done" }).eq("id", jobId);
  await audit({ action: "content.import_done", entityType: "import_job", entityId: jobId, spaceId: job.space_id });
  revalidatePath("/admin/conteudo");
  revalidatePath("/admin/importar");
  return { ok: true };
}

/** Remove um job (e opcionalmente o arquivo). */
export async function deleteImportJob(jobId: string): Promise<ImportResult> {
  const supabase = await createClient();
  const { data: job } = await supabase
    .from("import_jobs")
    .select("space_id, source_file")
    .eq("id", jobId)
    .single();
  if (!job) return { ok: false, error: "Job não encontrado." };
  try {
    await requirePermission("content.import", job.space_id);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }
  await supabase.storage.from("imports").remove([job.source_file]).catch(() => {});
  await supabase.from("import_jobs").delete().eq("id", jobId);
  revalidatePath("/admin/importar");
  return { ok: true };
}
