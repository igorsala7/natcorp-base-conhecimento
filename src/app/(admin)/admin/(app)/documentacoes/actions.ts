"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/auth/permissions";
import { audit } from "@/lib/auth/audit";
import { reindexNodeChunks } from "@/lib/content/chunk";

/**
 * Reindexa os embeddings de TODOS os artigos de uma documentação.
 *
 * Mesmo motor de `reindexSubtreeEmbeddings` (árvore), sem precisar escolher um
 * nó: é o botão "Gerar embeddings" do hub de documentações.
 */
export async function reindexSpaceEmbeddings(
  spaceId: string,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  try {
    await requirePermission("content.edit", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }

  const supabase = await createClient();
  const { data: nodes } = await supabase
    .from("nodes")
    .select("id")
    .eq("space_id", spaceId)
    .eq("type", "article")
    .is("deleted_at", null);

  let count = 0;
  for (const n of nodes ?? []) {
    const { data: art } = await supabase
      .from("articles")
      .select("id, content_json")
      .eq("node_id", n.id)
      .maybeSingle();
    if (!art) continue;
    await reindexNodeChunks(supabase, {
      nodeId: n.id,
      articleId: art.id,
      spaceId,
      doc: art.content_json,
      withEmbeddings: true,
    });
    count += 1;
  }

  await audit({
    action: "content.reindex_space",
    entityType: "space",
    entityId: spaceId,
    spaceId,
    after: { count },
  });
  return { ok: true, count };
}

/** Lista RECURSIVA de um prefixo no Storage (a API lista uma "pasta" por vez). */
async function listarStorage(
  storage: ReturnType<typeof createAdminClient>["storage"],
  bucket: string,
  prefixo: string,
  profundidade = 0,
): Promise<string[]> {
  if (profundidade > 6) return []; // teto defensivo
  const { data } = await storage.from(bucket).list(prefixo, { limit: 1000 });
  const caminhos: string[] = [];
  for (const item of data ?? []) {
    const caminho = prefixo ? `${prefixo}/${item.name}` : item.name;
    // Pasta vem sem `id`; arquivo vem com metadados.
    if (item.id) caminhos.push(caminho);
    else caminhos.push(...(await listarStorage(storage, bucket, caminho, profundidade + 1)));
  }
  return caminhos;
}

export type DeleteSpaceResult =
  | { ok: true; resumo: string }
  | { ok: false; error: string };

/**
 * Exclui uma documentação DEFINITIVAMENTE: árvore, artigos, versões,
 * embeddings, chatbots (chaves de widget), arquivos da base, conversas e os
 * objetos do Storage. A trilha de auditoria permanece.
 *
 * As linhas caem numa transação (RPC `delete_space_deep`, com a permissão
 * `space.delete` checada no banco); os ARQUIVOS são coletados ANTES e
 * removidos DEPOIS — se a remoção de algum falhar, sobra objeto órfão no
 * bucket, nunca uma documentação pela metade.
 */
export async function deleteSpace(spaceId: string): Promise<DeleteSpaceResult> {
  try {
    await requirePermission("space.delete", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão para excluir esta documentação." };
  }

  const supabase = await createClient();
  const admin = createAdminClient();

  // Caminhos do Storage ANTES do delete (as linhas somem com o cascade).
  const [{ data: jobs }, { data: kbDocs }] = await Promise.all([
    supabase.from("import_jobs").select("source_file").eq("space_id", spaceId),
    supabase.from("knowledge_documents").select("storage_path").eq("space_id", spaceId),
  ]);
  const importPaths = [
    ...(jobs ?? []).map((j) => j.source_file).filter((p): p is string => !!p),
    ...(kbDocs ?? []).map((d) => d.storage_path).filter((p): p is string => !!p),
  ];
  const assetPaths = await listarStorage(admin.storage, "assets", spaceId);

  const { data: resumo, error } = await supabase.rpc("delete_space_deep", {
    p_space_id: spaceId,
  });
  if (error) return { ok: false, error: error.message };

  // Storage por último; falha aqui não pode desfazer o que o banco já fez.
  let orfaos = 0;
  const remover = async (bucket: string, caminhos: string[]) => {
    for (let i = 0; i < caminhos.length; i += 100) {
      const { error: e } = await admin.storage.from(bucket).remove(caminhos.slice(i, i + 100));
      if (e) orfaos += Math.min(100, caminhos.length - i);
    }
  };
  await remover("assets", assetPaths);
  await remover("imports", importPaths);

  const r = (resumo ?? {}) as Record<string, unknown>;
  await audit({
    action: "space.delete",
    entityType: "space",
    entityId: spaceId,
    spaceId: null,
    before: r,
  });
  revalidatePath("/admin/documentacoes");
  revalidatePath("/admin/conteudo");

  const partes = [
    `${r.nodes ?? 0} nó(s)`,
    `${r.chunks ?? 0} trecho(s) indexado(s)`,
    `${r.chatbots ?? 0} chave(s) de chatbot`,
    `${r.arquivos ?? 0} arquivo(s) da base`,
    `${assetPaths.length + importPaths.length} objeto(s) do Storage`,
  ];
  return {
    ok: true,
    resumo:
      `Documentação "${r.slug ?? ""}" excluída: ${partes.join(", ")}.` +
      (orfaos ? ` (${orfaos} objeto(s) do Storage não puderam ser removidos.)` : ""),
  };
}
