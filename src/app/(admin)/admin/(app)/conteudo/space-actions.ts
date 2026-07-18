"use server";

import { revalidatePath } from "next/cache";
import { generateKeyBetween } from "fractional-indexing";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";
import { audit } from "@/lib/auth/audit";
import { slugify } from "@/lib/content/slug";
import type { Json } from "@/lib/database.types";

export type SpaceResult = { ok: true; id?: string } | { ok: false; error: string };

/** Cria um espaço-cliente que herda do global. */
export async function createClientSpace(
  name: string,
  slugInput?: string,
): Promise<SpaceResult> {
  try {
    await requirePermission("space.create");
  } catch {
    return { ok: false, error: "Sem permissão para criar espaços." };
  }
  const supabase = await createClient();
  const { data: global } = await supabase
    .from("spaces")
    .select("id")
    .eq("type", "global")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!global) return { ok: false, error: "Espaço global não encontrado." };

  const slug = slugify(slugInput || name);
  const { data, error } = await supabase
    .from("spaces")
    .insert({
      slug,
      name,
      type: "client",
      parent_space_id: global.id,
      visibility: "private",
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: `Falha: ${error?.message}` };

  await audit({ action: "space.create", entityType: "space", entityId: data.id, spaceId: data.id });
  revalidatePath("/admin/conteudo");
  return { ok: true, id: data.id };
}

/** Customizar (fork de 1 clique): copia o nó global para o espaço-cliente. */
export async function customizeNode(
  clientSpaceId: string,
  globalNodeId: string,
): Promise<SpaceResult> {
  try {
    await requirePermission("overlay.manage", clientSpaceId);
  } catch {
    return { ok: false, error: "Sem permissão para customizar." };
  }
  const supabase = await createClient();

  const { data: g } = await supabase
    .from("nodes")
    .select("type, title, slug, parent_id, position, link_url")
    .eq("id", globalNodeId)
    .single();
  if (!g) return { ok: false, error: "Nó global não encontrado." };

  // Cria o fork no espaço-cliente, na MESMA posição do global (parent + position).
  const { data: fork, error } = await supabase
    .from("nodes")
    .insert({
      space_id: clientSpaceId,
      parent_id: g.parent_id,
      type: g.type,
      title: g.title,
      slug: g.slug,
      position: g.position,
      link_url: g.link_url,
    })
    .select("id")
    .single();
  if (error || !fork) return { ok: false, error: `Falha ao criar fork: ${error?.message}` };

  // Copia o artigo (se houver).
  if (g.type === "article") {
    const { data: art } = await supabase
      .from("articles")
      .select("content_json")
      .eq("node_id", globalNodeId)
      .maybeSingle();
    await supabase.from("articles").insert({
      node_id: fork.id,
      content_json: (art?.content_json ?? { type: "doc", content: [] }) as Json,
    });
  }

  const { error: ovErr } = await supabase
    .from("space_overlays")
    .upsert(
      { space_id: clientSpaceId, source_node_id: globalNodeId, override_node_id: fork.id, hidden: false },
      { onConflict: "space_id,source_node_id" },
    );
  if (ovErr) return { ok: false, error: `Falha no overlay: ${ovErr.message}` };

  await audit({ action: "overlay.customize", entityType: "node", entityId: globalNodeId, spaceId: clientSpaceId });
  revalidatePath("/admin/conteudo");
  return { ok: true, id: fork.id };
}

/** Oculta um nó herdado no espaço-cliente. */
export async function hideNode(
  clientSpaceId: string,
  globalNodeId: string,
  hidden: boolean,
): Promise<SpaceResult> {
  try {
    await requirePermission("overlay.manage", clientSpaceId);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("space_overlays")
    .upsert(
      { space_id: clientSpaceId, source_node_id: globalNodeId, hidden },
      { onConflict: "space_id,source_node_id" },
    );
  if (error) return { ok: false, error: `Falha: ${error.message}` };

  await audit({ action: hidden ? "overlay.hide" : "overlay.unhide", entityType: "node", entityId: globalNodeId, spaceId: clientSpaceId });
  revalidatePath("/admin/conteudo");
  return { ok: true };
}

/** Reverte a customização: remove o fork e o overlay (volta a herdar). */
export async function revertOverlay(
  clientSpaceId: string,
  sourceNodeId: string,
): Promise<SpaceResult> {
  try {
    await requirePermission("overlay.manage", clientSpaceId);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }
  const supabase = await createClient();
  const { data: ov } = await supabase
    .from("space_overlays")
    .select("override_node_id")
    .eq("space_id", clientSpaceId)
    .eq("source_node_id", sourceNodeId)
    .maybeSingle();
  if (ov?.override_node_id) {
    await supabase.from("nodes").delete().eq("id", ov.override_node_id);
  }
  await supabase
    .from("space_overlays")
    .delete()
    .eq("space_id", clientSpaceId)
    .eq("source_node_id", sourceNodeId);

  await audit({ action: "overlay.revert", entityType: "node", entityId: sourceNodeId, spaceId: clientSpaceId });
  revalidatePath("/admin/conteudo");
  return { ok: true };
}

/** Cria um nó exclusivo do cliente. */
export async function createExclusiveNode(input: {
  clientSpaceId: string;
  parentId: string | null;
  type: "folder" | "article";
  title: string;
}): Promise<SpaceResult> {
  try {
    await requirePermission("content.create", input.clientSpaceId);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }
  const supabase = await createClient();

  // posição = fim da lista de irmãos no espaço-cliente
  let q = supabase
    .from("nodes")
    .select("position")
    .eq("space_id", input.clientSpaceId)
    .is("deleted_at", null)
    .order("position", { ascending: false })
    .limit(1);
  q = input.parentId ? q.eq("parent_id", input.parentId) : q.is("parent_id", null);
  const { data: last } = await q.maybeSingle();
  const position = generateKeyBetween(last?.position ?? null, null);

  const { data: node, error } = await supabase
    .from("nodes")
    .insert({
      space_id: input.clientSpaceId,
      parent_id: input.parentId,
      type: input.type,
      title: input.title,
      slug: `${slugify(input.title)}-${Math.random().toString(36).slice(2, 6)}`,
      position,
    })
    .select("id")
    .single();
  if (error || !node) return { ok: false, error: `Falha: ${error?.message}` };

  if (input.type === "article") {
    await supabase.from("articles").insert({ node_id: node.id });
  }
  revalidatePath("/admin/conteudo");
  return { ok: true, id: node.id };
}
