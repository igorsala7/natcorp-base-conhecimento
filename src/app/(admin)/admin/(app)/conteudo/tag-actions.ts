"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";
import { audit } from "@/lib/auth/audit";
import { slugify } from "@/lib/content/slug";

export type TagInfo = { id: string; name: string; slug: string; artigos: number };
export type TagActionResult = { ok: true; id?: string } | { ok: false; error: string };

function err(error: string): TagActionResult {
  return { ok: false, error };
}

/** Tags da documentação com contagem de artigos (para a tela de gestão). */
export async function listTags(spaceId: string): Promise<TagInfo[]> {
  const supabase = await createClient();
  const { data: tags } = await supabase
    .from("tags")
    .select("id, name, slug")
    .eq("space_id", spaceId)
    .order("name");
  if (!tags?.length) return [];
  const { data: links } = await supabase
    .from("node_tags")
    .select("tag_id")
    .in("tag_id", tags.map((t) => t.id));
  const contagem = new Map<string, number>();
  for (const l of links ?? []) contagem.set(l.tag_id, (contagem.get(l.tag_id) ?? 0) + 1);
  return tags.map((t) => ({ ...t, artigos: contagem.get(t.id) ?? 0 }));
}

const nomeSchema = z.string().trim().min(1).max(60);

/** Cria (ou devolve a existente de mesmo slug — criação inline não duplica). */
export async function createTag(spaceId: string, name: string): Promise<TagActionResult> {
  const parsed = nomeSchema.safeParse(name);
  if (!parsed.success) return err("Nome inválido (1–60 caracteres).");
  try {
    await requirePermission("content.edit", spaceId);
  } catch {
    return err("Sem permissão.");
  }
  const supabase = await createClient();
  const slug = slugify(parsed.data);
  if (!slug) return err("Nome inválido.");
  const { data: existente } = await supabase
    .from("tags")
    .select("id")
    .eq("space_id", spaceId)
    .eq("slug", slug)
    .maybeSingle();
  if (existente) return { ok: true, id: existente.id };
  const { data, error } = await supabase
    .from("tags")
    .insert({ space_id: spaceId, name: parsed.data, slug })
    .select("id")
    .single();
  if (error || !data) return err(`Falha: ${error?.message ?? "?"}`);
  await audit({ action: "content.tag_create", entityType: "tag", entityId: data.id, spaceId });
  return { ok: true, id: data.id };
}

export async function renameTag(tagId: string, name: string): Promise<TagActionResult> {
  const parsed = nomeSchema.safeParse(name);
  if (!parsed.success) return err("Nome inválido (1–60 caracteres).");
  const supabase = await createClient();
  const { data: tag } = await supabase
    .from("tags")
    .select("space_id, name")
    .eq("id", tagId)
    .single();
  if (!tag) return err("Tag não encontrada.");
  try {
    await requirePermission("content.edit", tag.space_id);
  } catch {
    return err("Sem permissão.");
  }
  // O slug NÃO muda junto: ele pode estar em links públicos `?tag=` já
  // compartilhados — renomear é cosmético, migrar URL é decisão separada.
  const { error } = await supabase.from("tags").update({ name: parsed.data }).eq("id", tagId);
  if (error) return err(`Falha: ${error.message}`);
  await audit({
    action: "content.tag_rename",
    entityType: "tag",
    entityId: tagId,
    spaceId: tag.space_id,
    before: { name: tag.name },
    after: { name: parsed.data },
  });
  revalidatePath("/docs", "layout");
  return { ok: true };
}

export async function deleteTag(tagId: string): Promise<TagActionResult> {
  const supabase = await createClient();
  const { data: tag } = await supabase
    .from("tags")
    .select("space_id, name")
    .eq("id", tagId)
    .single();
  if (!tag) return err("Tag não encontrada.");
  try {
    await requirePermission("content.edit", tag.space_id);
  } catch {
    return err("Sem permissão.");
  }
  const { error } = await supabase.from("tags").delete().eq("id", tagId);
  if (error) return err(`Falha: ${error.message}`);
  await audit({
    action: "content.tag_delete",
    entityType: "tag",
    entityId: tagId,
    spaceId: tag.space_id,
    before: { name: tag.name },
  });
  revalidatePath("/docs", "layout");
  return { ok: true };
}

/** Mescla N tags na tag-destino (padrão HubSpot): reatribui vínculos e apaga. */
export async function mergeTags(tagIds: string[], targetId: string): Promise<TagActionResult> {
  const fontes = tagIds.filter((id) => id !== targetId);
  if (!fontes.length) return err("Escolha ao menos uma tag diferente da tag-destino.");
  const supabase = await createClient();
  const { data: alvo } = await supabase
    .from("tags")
    .select("id, space_id")
    .eq("id", targetId)
    .single();
  if (!alvo) return err("Tag-destino não encontrada.");
  try {
    await requirePermission("content.edit", alvo.space_id);
  } catch {
    return err("Sem permissão.");
  }
  const { data: vinculos } = await supabase
    .from("node_tags")
    .select("node_id")
    .in("tag_id", fontes);
  const nodeIds = [...new Set((vinculos ?? []).map((v) => v.node_id))];
  if (nodeIds.length) {
    // upsert ignora quem já tem a tag-destino (PK composta).
    const { error } = await supabase
      .from("node_tags")
      .upsert(nodeIds.map((node_id) => ({ node_id, tag_id: targetId })), {
        onConflict: "node_id,tag_id",
        ignoreDuplicates: true,
      });
    if (error) return err(`Falha ao reatribuir: ${error.message}`);
  }
  const { error } = await supabase
    .from("tags")
    .delete()
    .in("id", fontes)
    .eq("space_id", alvo.space_id); // não deixa mesclar tag de outra documentação
  if (error) return err(`Falha ao remover: ${error.message}`);
  await audit({
    action: "content.tag_merge",
    entityType: "tag",
    entityId: targetId,
    spaceId: alvo.space_id,
    before: { merged: fontes },
    after: { articles: nodeIds.length },
  });
  revalidatePath("/docs", "layout");
  return { ok: true };
}

/** Tags e autor atuais de um nó (para o diálogo de propriedades). */
export async function getNodeTagsAndAuthor(
  nodeId: string,
): Promise<{ tagIds: string[]; authorId: string | null }> {
  const supabase = await createClient();
  const [{ data: links }, { data: node }] = await Promise.all([
    supabase.from("node_tags").select("tag_id").eq("node_id", nodeId),
    supabase.from("nodes").select("author_id").eq("id", nodeId).maybeSingle(),
  ]);
  return {
    tagIds: (links ?? []).map((l) => l.tag_id),
    authorId: node?.author_id ?? null,
  };
}

/** Substitui o conjunto de tags do nó. */
export async function setNodeTags(nodeId: string, tagIds: string[]): Promise<TagActionResult> {
  const parsed = z.array(z.string().uuid()).max(20).safeParse(tagIds);
  if (!parsed.success) return err("Tags inválidas.");
  const supabase = await createClient();
  const { data: node } = await supabase
    .from("nodes")
    .select("space_id")
    .eq("id", nodeId)
    .single();
  if (!node) return err("Nó não encontrado.");
  try {
    await requirePermission("content.edit", node.space_id);
  } catch {
    return err("Sem permissão.");
  }
  // Só tags da MESMA documentação (o RLS deixaria, a integridade não).
  const { data: validas } = await supabase
    .from("tags")
    .select("id")
    .eq("space_id", node.space_id)
    .in("id", parsed.data.length ? parsed.data : ["00000000-0000-0000-0000-000000000000"]);
  const manter = new Set((validas ?? []).map((t) => t.id));
  const { error: delErr } = await supabase.from("node_tags").delete().eq("node_id", nodeId);
  if (delErr) return err(`Falha: ${delErr.message}`);
  if (manter.size) {
    const { error } = await supabase
      .from("node_tags")
      .insert([...manter].map((tag_id) => ({ node_id: nodeId, tag_id })));
    if (error) return err(`Falha: ${error.message}`);
  }
  revalidatePath("/docs", "layout");
  return { ok: true };
}

/** Define o autor público do artigo (null limpa). */
export async function setNodeAuthor(
  nodeId: string,
  authorId: string | null,
): Promise<TagActionResult> {
  const parsed = z.string().uuid().nullable().safeParse(authorId);
  if (!parsed.success) return err("Autor inválido.");
  const supabase = await createClient();
  const { data: node } = await supabase
    .from("nodes")
    .select("space_id, author_id")
    .eq("id", nodeId)
    .single();
  if (!node) return err("Nó não encontrado.");
  try {
    await requirePermission("content.edit", node.space_id);
  } catch {
    return err("Sem permissão.");
  }
  const { error } = await supabase
    .from("nodes")
    .update({ author_id: parsed.data })
    .eq("id", nodeId);
  if (error) return err(`Falha: ${error.message}`);
  revalidatePath("/docs", "layout");
  return { ok: true };
}
