"use server";

import { revalidatePath } from "next/cache";
import { generateKeyBetween } from "fractional-indexing";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePermission, PermissionError } from "@/lib/auth/permissions";
import { audit } from "@/lib/auth/audit";
import { slugify } from "@/lib/content/slug";
import { slugPathsOf, subtreeIds } from "@/lib/content/tree";

export type NodeActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

function err(error: string): NodeActionResult {
  return { ok: false, error };
}

/** Slug único dentro de (space_id, parent_id). Anexa -2, -3… se colidir. */
async function uniqueSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  spaceId: string,
  parentId: string | null,
  base: string,
): Promise<string> {
  const root = slugify(base);
  let candidate = root;
  let n = 1;
  // Tenta até achar um livre (limite defensivo).
  while (n < 50) {
    let q = supabase
      .from("nodes")
      .select("id")
      .eq("space_id", spaceId)
      .eq("slug", candidate)
      .is("deleted_at", null);
    q = parentId ? q.eq("parent_id", parentId) : q.is("parent_id", null);
    const { data } = await q.maybeSingle();
    if (!data) return candidate;
    n += 1;
    candidate = `${root}-${n}`;
  }
  return `${root}-${Date.now()}`;
}

const createSchema = z.object({
  spaceId: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  type: z.enum(["folder", "article", "link", "divider"]),
  title: z.string().min(1).max(200),
});

/** Cria um nó no fim da lista de irmãos. Se for artigo, cria o articles vazio. */
export async function createNode(input: {
  spaceId: string;
  parentId: string | null;
  type: "folder" | "article" | "link" | "divider";
  title: string;
}): Promise<NodeActionResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return err("Dados inválidos.");
  const { spaceId, parentId, type, title } = parsed.data;

  try {
    await requirePermission("content.create", spaceId);
  } catch {
    return err("Sem permissão para criar conteúdo.");
  }

  const supabase = await createClient();

  // position = fim da lista de irmãos (maior position atual).
  let q = supabase
    .from("nodes")
    .select("position")
    .eq("space_id", spaceId)
    .is("deleted_at", null)
    .order("position", { ascending: false })
    .limit(1);
  q = parentId ? q.eq("parent_id", parentId) : q.is("parent_id", null);
  const { data: last } = await q.maybeSingle();
  const position = generateKeyBetween(last?.position ?? null, null);

  const slug = await uniqueSlug(supabase, spaceId, parentId, title);

  const { data: node, error } = await supabase
    .from("nodes")
    .insert({ space_id: spaceId, parent_id: parentId, type, title, slug, position })
    .select("id")
    .single();
  if (error || !node) return err(`Falha ao criar: ${error?.message ?? ""}`);

  if (type === "article") {
    await supabase.from("articles").insert({ node_id: node.id });
  }

  await audit({
    action: "content.create",
    entityType: "node",
    entityId: node.id,
    spaceId,
    after: { type, title },
  });
  revalidatePath("/admin/conteudo");
  return { ok: true, id: node.id };
}

/** Renomeia um nó (mantém o slug para não quebrar URLs — redirects na Fase 2). */
export async function renameNode(
  id: string,
  title: string,
): Promise<NodeActionResult> {
  const supabase = await createClient();
  const { data: node } = await supabase
    .from("nodes")
    .select("space_id")
    .eq("id", id)
    .single();
  if (!node) return err("Nó não encontrado.");
  try {
    await requirePermission("content.edit", node.space_id);
  } catch {
    return err("Sem permissão para editar.");
  }

  const { error } = await supabase
    .from("nodes")
    .update({ title: title.trim() || "Sem título" })
    .eq("id", id);
  if (error) return err(`Falha: ${error.message}`);

  await audit({ action: "content.rename", entityType: "node", entityId: id });
  revalidatePath("/admin/conteudo");
  return { ok: true };
}

/**
 * Muda o slug de um nó e cria redirects 301 para os caminhos antigos do nó e
 * de toda a sua subárvore — URLs já compartilhadas nunca podem quebrar.
 */
export async function changeSlug(
  id: string,
  newSlug: string,
): Promise<NodeActionResult> {
  const supabase = await createClient();
  const { data: node } = await supabase
    .from("nodes")
    .select("space_id, parent_id, slug")
    .eq("id", id)
    .single();
  if (!node) return err("Nó não encontrado.");
  try {
    await requirePermission("content.edit", node.space_id);
  } catch {
    return err("Sem permissão para editar.");
  }

  const slug = await uniqueSlug(supabase, node.space_id, node.parent_id, newSlug);
  if (slug === node.slug) return { ok: true };

  // Caminhos antigos (nó + descendentes) ANTES da mudança.
  const oldPaths = await slugPathsOf(node.space_id);
  const affected = await subtreeIds(node.space_id, id);

  const { error } = await supabase
    .from("nodes")
    .update({ slug })
    .eq("id", id);
  if (error) return err(`Falha: ${error.message}`);

  // Um redirect por nó afetado: caminho antigo → id do nó (o portal resolve
  // o caminho atual do nó no momento do acesso).
  const redirects = affected
    .map((nid) => {
      const p = oldPaths.get(nid);
      return p
        ? { space_id: node.space_id, from_path: p.join("/"), to_node_id: nid }
        : null;
    })
    .filter(Boolean) as {
    space_id: string;
    from_path: string;
    to_node_id: string;
  }[];
  if (redirects.length) {
    await supabase.from("redirects").upsert(redirects, {
      onConflict: "space_id,from_path",
    });
  }

  await audit({
    action: "content.slug_change",
    entityType: "node",
    entityId: id,
    spaceId: node.space_id,
    before: { slug: node.slug },
    after: { slug },
  });
  revalidatePath("/admin/conteudo");
  return { ok: true };
}

/**
 * Move/reordena um nó entre dois irmãos (ordenação fracionária: 1 escrita).
 * A função SQL move_node reescreve o path da subárvore e checa tree.reorganize.
 */
export async function moveNode(input: {
  id: string;
  newParentId: string | null;
  prevPosition: string | null;
  nextPosition: string | null;
}): Promise<NodeActionResult> {
  const { id, newParentId, prevPosition, nextPosition } = input;
  let position: string;
  try {
    position = generateKeyBetween(prevPosition, nextPosition);
  } catch {
    return err("Posição inválida.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("move_node", {
    p_node_id: id,
    // Runtime: null → SQL NULL (raiz); a função trata. O tipo gerado é string.
    p_new_parent_id: newParentId as string,
    p_position: position,
  });
  if (error) {
    return err(
      error.message.includes("permiss")
        ? "Sem permissão para reorganizar a árvore."
        : `Falha ao mover: ${error.message}`,
    );
  }

  await audit({ action: "content.move", entityType: "node", entityId: id });
  revalidatePath("/admin/conteudo");
  return { ok: true };
}

/** Soft delete da subárvore (lixeira). */
export async function deleteNode(id: string): Promise<NodeActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("soft_delete_subtree", {
    p_node_id: id,
  });
  if (error) {
    return err(
      error.message.includes("permiss")
        ? "Sem permissão para excluir."
        : `Falha: ${error.message}`,
    );
  }
  await audit({ action: "content.delete", entityType: "node", entityId: id });
  revalidatePath("/admin/conteudo");
  return { ok: true };
}

export { PermissionError };
