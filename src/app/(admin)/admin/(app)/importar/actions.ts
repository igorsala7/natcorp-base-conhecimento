"use server";

import { revalidatePath } from "next/cache";
import { generateKeyBetween } from "fractional-indexing";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";
import { audit } from "@/lib/auth/audit";
import { uniqueSlug } from "@/lib/content/unique-slug";
import { enqueueImport, enqueueImportImprove } from "@/lib/jobs/boss";
import type { ProposedNode, ContentItem } from "@/lib/importer/structure";
import { newId, type Block, type BlockDoc } from "@/lib/blocks/schema";
import type { Json } from "@/lib/database.types";

export type ImportResult =
  | {
      ok: true;
      id?: string;
      improving?: boolean;
      /** Onde o conteúdo entrou: o diretório criado/escolhido (null = raiz). */
      destino?: { nodeId: string | null; spaceId: string };
    }
  | { ok: false; error: string };

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

/** Converte os itens de conteúdo em um documento de blocos v2. */
function toBlocks(content: ContentItem[], images: string[]): BlockDoc {
  const blocks: Block[] = content.map((c) =>
    c.type === "p"
      ? { id: newId(), type: "paragraph", text: c.text ? [{ text: c.text }] : [] }
      : { id: newId(), type: "image", data: { src: images[c.image] ?? "", alt: "", caption: "" } },
  );
  return { version: 2, blocks: blocks.length ? blocks : [{ id: newId(), type: "paragraph", text: [] }] };
}

async function insertProposed(
  supabase: Awaited<ReturnType<typeof createClient>>,
  spaceId: string,
  parentId: string | null,
  node: ProposedNode,
  images: string[],
  prevPos: string | null,
  /** Ids criados, na ordem — usados para desfazer se a materialização falhar. */
  criados: string[],
): Promise<string> {
  const isFolder = node.children.length > 0;
  const type = isFolder ? "folder" : "article";
  const position = generateKeyBetween(prevPos, null);
  // Slug legível e único no destino (antes usava sufixo aleatório, que sujava a URL).
  const slug = await uniqueSlug(supabase, spaceId, parentId, node.title || "sem-titulo");

  const { data: created, error } = await supabase
    .from("nodes")
    .insert({
      space_id: spaceId,
      parent_id: parentId,
      type,
      title: node.title || "Sem título",
      slug,
      position,
    })
    .select("id")
    .single();
  if (error || !created) throw new Error(error?.message ?? "insert falhou");
  criados.push(created.id);

  if (!isFolder) {
    await supabase.from("articles").insert({
      node_id: created.id,
      content_json: toBlocks(node.content, images) as unknown as Json,
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
      criados,
    );
  }

  // Filhos.
  let childPrev: string | null = node.content.length > 0 ? generateKeyBetween(null, null) : null;
  for (const child of node.children) {
    childPrev = await insertProposed(
      supabase,
      spaceId,
      created.id,
      child,
      images,
      childPrev,
      criados,
    );
  }

  return position;
}

/** Destino escolhido na confirmação da importação. */
export type ImportTarget = {
  /** Documentação (espaço) de destino. */
  spaceId: string;
  /** Pasta onde pendurar; null = raiz da documentação. */
  parentId: string | null;
  /** Se preenchido, cria esta pasta no destino e pendura TUDO dentro dela. */
  newFolderTitle?: string | null;
};

/** Materializa a árvore proposta (possivelmente editada) na árvore real. */
export async function materializeImport(
  jobId: string,
  editedTree?: ProposedNode[],
  target?: ImportTarget,
  opcoes?: {
    /** Depois de criar a árvore, a IA reformata o layout de TODOS os artigos
     *  (fase 'improving', no worker — pode levar minutos num documento grande). */
    melhorarLayout?: boolean;
  },
): Promise<ImportResult> {
  const supabase = await createClient();
  const { data: job } = await supabase
    .from("import_jobs")
    .select("space_id, target_parent_id, result_tree, status")
    .eq("id", jobId)
    .single();
  if (!job) return { ok: false, error: "Job não encontrado." };

  // Destino: o escolhido na tela vence o que ficou gravado no job.
  const spaceId = target?.spaceId ?? job.space_id;
  const baseParentId = target?.parentId ?? job.target_parent_id ?? null;

  try {
    // Precisa poder importar no job E criar conteúdo na documentação destino.
    await requirePermission("content.import", job.space_id);
    await requirePermission("content.create", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão para importar nesta documentação." };
  }

  // O pai precisa pertencer à documentação destino (evita árvore inconsistente).
  if (baseParentId) {
    const { data: parent } = await supabase
      .from("nodes")
      .select("id, type, space_id")
      .eq("id", baseParentId)
      .maybeSingle();
    if (!parent || parent.space_id !== spaceId) {
      return { ok: false, error: "A pasta de destino não pertence à documentação escolhida." };
    }
    if (parent.type !== "folder") {
      return { ok: false, error: "O destino precisa ser uma pasta." };
    }
  }

  const stored = job.result_tree as { tree: ProposedNode[]; images: string[] } | null;
  const tree = editedTree ?? stored?.tree ?? [];
  const images = stored?.images ?? [];
  if (tree.length === 0) return { ok: false, error: "Nada a importar." };

  if (job.status !== "preview") {
    return {
      ok: false,
      error:
        job.status === "done"
          ? "Esta importação já foi concluída."
          : `Importação não está pronta para materializar (status: ${job.status}).`,
    };
  }

  // Trava otimista: só um chamador consegue sair de 'preview'. Sem isso, duplo
  // clique ou reload da página re-executava a inserção e duplicava a árvore.
  const { data: travado } = await supabase
    .from("import_jobs")
    .update({ status: "importing" })
    .eq("id", jobId)
    .eq("status", "preview")
    .select("id");
  if (!travado?.length) {
    return { ok: false, error: "Esta importação já está sendo materializada." };
  }

  // Tudo que for criado entra aqui, para poder ser desfeito se algo falhar no meio.
  const criados: string[] = [];
  // Onde o conteúdo vai pendurar: a pasta nova (se pedida) ou o pai escolhido.
  // Fica fora do try porque o destino é gravado no job depois da inserção.
  let rootParentId = baseParentId;

  try {
    // Posição inicial = fim da lista de irmãos no destino.
    const lastPosition = async (parentId: string | null) => {
      let q = supabase
        .from("nodes")
        .select("position")
        .eq("space_id", spaceId)
        .is("deleted_at", null)
        .order("position", { ascending: false })
        .limit(1);
      q = parentId ? q.eq("parent_id", parentId) : q.is("parent_id", null);
      const { data } = await q.maybeSingle();
      return data?.position ?? null;
    };

    // Opcional: cria a pasta que vai receber todo o conteúdo importado.
    const novaPasta = target?.newFolderTitle?.trim();
    if (novaPasta) {
      const slug = await uniqueSlug(supabase, spaceId, baseParentId, novaPasta);
      const { data: folder, error } = await supabase
        .from("nodes")
        .insert({
          space_id: spaceId,
          parent_id: baseParentId,
          type: "folder",
          title: novaPasta,
          slug,
          position: generateKeyBetween(await lastPosition(baseParentId), null),
        })
        .select("id")
        .single();
      if (error || !folder) throw new Error(error?.message ?? "falha ao criar a pasta de destino");
      criados.push(folder.id);
      rootParentId = folder.id;
    }

    let prev: string | null = await lastPosition(rootParentId);
    for (const node of tree) {
      prev = await insertProposed(supabase, spaceId, rootParentId, node, images, prev, criados);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Desfaz o que já entrou: sem isso a árvore ficava pela metade e o usuário
    // não tinha como distinguir o importado do preexistente. Ordem inversa da
    // inserção = filhos antes dos pais.
    let desfeitos = 0;
    for (const id of [...criados].reverse()) {
      const { error: delErro } = await supabase.from("nodes").delete().eq("id", id);
      if (!delErro) desfeitos++;
    }
    const limpo = desfeitos === criados.length;
    const parcial = limpo
      ? ""
      : ` Atenção: ${criados.length - desfeitos} de ${criados.length} nós não puderam ser removidos.`;
    // Rollback completo → volta para 'preview' e o usuário pode tentar de novo
    // sem duplicar nada. Rollback parcial → 'error', porque repetir duplicaria.
    await supabase
      .from("import_jobs")
      .update({ status: limpo ? "preview" : "error", error: msg })
      .eq("id", jobId);
    return { ok: false, error: `Falha ao materializar: ${msg}.${parcial}` };
  }

  // Guarda o DESTINO no job: é o que permite à tela de progresso levar o
  // usuário ao diretório novo quando a melhoria de layout terminar.
  const destino = { nodeId: rootParentId, spaceId };
  await supabase
    .from("import_jobs")
    .update({
      result_tree: { ...(stored ?? {}), destinoNodeId: rootParentId, destinoSpaceId: spaceId } as Json,
    })
    .eq("id", jobId);

  // Melhoria de layout: fase em segundo plano sobre os ARTIGOS criados.
  // A árvore já está no lugar — se o worker estiver parado, nada se perde:
  // o conteúdo fica como veio da extração.
  let melhorando = false;
  if (opcoes?.melhorarLayout && criados.length) {
    const { data: artigos } = await supabase
      .from("nodes")
      .select("id")
      .in("id", criados)
      .eq("type", "article");
    const nodeIds = (artigos ?? []).map((a) => a.id);
    if (nodeIds.length) {
      try {
        await enqueueImportImprove(jobId, nodeIds);
        await supabase
          .from("import_jobs")
          .update({ status: "improving", progress: 0 })
          .eq("id", jobId);
        await supabase.rpc("import_job_log_append", {
          p_job_id: jobId,
          p_msg: `Árvore criada. Melhorando o layout de ${nodeIds.length} artigo(s) com IA…`,
        });
        melhorando = true;
      } catch {
        // Fila indisponível não pode desfazer uma importação que DEU certo:
        // segue como 'done' e o usuário melhora pelo editor se quiser.
        melhorando = false;
      }
    }
  }

  if (!melhorando) {
    await supabase.from("import_jobs").update({ status: "done" }).eq("id", jobId);
  }
  await audit({
    action: "content.import_done",
    entityType: "import_job",
    entityId: jobId,
    spaceId,
    after: {
      parentId: baseParentId,
      newFolder: target?.newFolderTitle ?? null,
      melhorarLayout: !!opcoes?.melhorarLayout,
    },
  });
  revalidatePath("/admin/conteudo");
  revalidatePath("/admin/importar");
  return { ok: true, improving: melhorando, destino };
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
