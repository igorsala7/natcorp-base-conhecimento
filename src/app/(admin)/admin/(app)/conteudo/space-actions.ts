"use server";

import { revalidatePath } from "next/cache";
import { generateKeyBetween } from "fractional-indexing";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";
import { audit } from "@/lib/auth/audit";
import { slugify } from "@/lib/content/slug";
import { copyNodesDeep } from "@/lib/content/copy-nodes";
import type { Json } from "@/lib/database.types";

export type SpaceResult = { ok: true; id?: string } | { ok: false; error: string };

/**
 * Como a nova documentação nasce:
 * - `empty`   → vazia e independente.
 * - `inherit` → herda de outra documentação (herança VIVA por sobreposição:
 *               reflete a origem e permite customizar/ocultar item a item).
 * - `copy`    → cópia independente do conteúdo (a origem pode mudar depois que
 *               a cópia não muda junto).
 */
export type NewSpaceMode = "empty" | "inherit" | "copy";

/** Slug de espaço único (spaces.slug é único global). */
async function uniqueSpaceSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  base: string,
): Promise<string> {
  const root = slugify(base) || "documentacao";
  let candidate = root;
  let n = 1;
  while (n < 50) {
    const { data } = await supabase
      .from("spaces")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data) return candidate;
    n += 1;
    candidate = `${root}-${n}`;
  }
  return `${root}-${Date.now()}`;
}

/** Cria uma documentação vazia, herdada ou como cópia de outra. */
export async function createSpace(input: {
  name: string;
  mode: NewSpaceMode;
  sourceSpaceId?: string | null;
  /**
   * Copia a aparência da home (coluna `theme`) desta documentação. Aceita uma
   * origem PRÓPRIA, independente do modo: dá para criar uma documentação vazia
   * já com a marca de outra. A cópia é um retrato — editar depois não afeta a
   * origem, nem o contrário.
   */
  copyLayoutFromSpaceId?: string | null;
}): Promise<SpaceResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Informe o nome da documentação." };
  try {
    await requirePermission("space.create");
  } catch {
    return { ok: false, error: "Sem permissão para criar documentações." };
  }
  const supabase = await createClient();

  const precisaOrigem = input.mode === "inherit" || input.mode === "copy";
  if (precisaOrigem && !input.sourceSpaceId) {
    return { ok: false, error: "Escolha a documentação de origem." };
  }
  if (input.sourceSpaceId) {
    try {
      await requirePermission("content.view", input.sourceSpaceId);
    } catch {
      return { ok: false, error: "Sem permissão para ler a documentação de origem." };
    }
  }

  // Aparência copiada: lê ANTES de criar, para não deixar o espaço criado e a
  // cópia falhar depois.
  let theme: Json | null = null;
  if (input.copyLayoutFromSpaceId) {
    try {
      await requirePermission("content.view", input.copyLayoutFromSpaceId);
    } catch {
      return { ok: false, error: "Sem permissão para ler o layout de origem." };
    }
    const { data: origem } = await supabase
      .from("spaces")
      .select("theme")
      .eq("id", input.copyLayoutFromSpaceId)
      .maybeSingle();
    theme = (origem?.theme as Json) ?? null;
  }

  const slug = await uniqueSpaceSlug(supabase, name);
  const { data: space, error } = await supabase
    .from("spaces")
    .insert({
      slug,
      name,
      // Herdada = espaço-cliente ligado à origem (overlays resolvem a herança).
      type: input.mode === "inherit" ? "client" : "global",
      parent_space_id: input.mode === "inherit" ? input.sourceSpaceId! : null,
      visibility: "private",
      ...(theme ? { theme } : {}),
    })
    .select("id")
    .single();
  if (error || !space) return { ok: false, error: `Falha ao criar: ${error?.message}` };

  if (input.mode === "copy") {
    try {
      await copyNodesDeep(supabase, {
        sourceSpaceId: input.sourceSpaceId!,
        rootIds: null, // documentação inteira
        destSpaceId: space.id,
        destParentId: null,
      });
    } catch (e) {
      // Desfaz: melhor não deixar uma documentação pela metade.
      await supabase.from("spaces").delete().eq("id", space.id);
      return { ok: false, error: `Falha ao copiar o conteúdo: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  await audit({
    action: "space.create",
    entityType: "space",
    entityId: space.id,
    spaceId: space.id,
    after: { mode: input.mode, source: input.sourceSpaceId ?? null },
  });
  revalidatePath("/admin/conteudo");
  return { ok: true, id: space.id };
}

/** Pastas de uma documentação, achatadas — para os seletores de destino. */
export async function listSpaceFolders(
  spaceId: string,
): Promise<{ id: string; title: string; depth: number }[]> {
  try {
    await requirePermission("content.view", spaceId);
  } catch {
    return [];
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("nodes")
    .select("id, parent_id, title, position")
    .eq("space_id", spaceId)
    .eq("type", "folder")
    .is("deleted_at", null)
    .order("position");

  const rows = data ?? [];
  const byParent = new Map<string | null, typeof rows>();
  for (const n of rows) {
    const list = byParent.get(n.parent_id) ?? [];
    list.push(n);
    byParent.set(n.parent_id, list);
  }
  const out: { id: string; title: string; depth: number }[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const n of byParent.get(parent) ?? []) {
      out.push({ id: n.id, title: n.title, depth });
      walk(n.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/** Copia os nós selecionados (com subárvore) para outra documentação. */
export async function copyNodesToSpace(
  nodeIds: string[],
  destSpaceId: string,
  destParentId: string | null,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  if (nodeIds.length === 0) return { ok: false, error: "Nada selecionado." };
  const supabase = await createClient();

  const { data: src } = await supabase
    .from("nodes")
    .select("space_id")
    .eq("id", nodeIds[0]!)
    .maybeSingle();
  if (!src) return { ok: false, error: "Item de origem não encontrado." };

  try {
    await requirePermission("content.view", src.space_id);
    await requirePermission("content.create", destSpaceId);
  } catch {
    return { ok: false, error: "Sem permissão para copiar para esta documentação." };
  }
  if (destParentId) {
    const { data: parent } = await supabase
      .from("nodes")
      .select("space_id, type")
      .eq("id", destParentId)
      .maybeSingle();
    if (!parent || parent.space_id !== destSpaceId || parent.type !== "folder") {
      return { ok: false, error: "Pasta de destino inválida." };
    }
  }

  try {
    const count = await copyNodesDeep(supabase, {
      sourceSpaceId: src.space_id,
      rootIds: nodeIds,
      destSpaceId,
      destParentId,
    });
    await audit({
      action: "content.copy_to_space",
      entityType: "space",
      entityId: destSpaceId,
      spaceId: destSpaceId,
      after: { from: src.space_id, nodes: nodeIds.length, created: count },
    });
    revalidatePath("/admin/conteudo");
    return { ok: true, count };
  } catch (e) {
    return { ok: false, error: `Falha ao copiar: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * Move os nós selecionados para outra documentação.
 *
 * Implementado como COPIAR + mandar o original para a lixeira: a RPC `move_node`
 * não troca `space_id` (e o `path` ltree precisaria ser reescrito). Assim o
 * original continua recuperável na lixeira por 30 dias.
 */
export async function moveNodesToSpace(
  nodeIds: string[],
  destSpaceId: string,
  destParentId: string | null,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const copied = await copyNodesToSpace(nodeIds, destSpaceId, destParentId);
  if (!copied.ok) return copied;

  const supabase = await createClient();
  const { data: src } = await supabase
    .from("nodes")
    .select("space_id")
    .eq("id", nodeIds[0]!)
    .maybeSingle();
  try {
    if (src) await requirePermission("content.delete", src.space_id);
  } catch {
    return { ok: false, error: "Copiado, mas sem permissão para remover a origem." };
  }
  for (const id of nodeIds) {
    await supabase.rpc("soft_delete_subtree", { p_node_id: id });
  }
  revalidatePath("/admin/conteudo");
  return { ok: true, count: copied.count };
}

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
