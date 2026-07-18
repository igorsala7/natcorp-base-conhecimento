"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { audit } from "@/lib/auth/audit";

export type TrashResult = { ok: true; count?: number } | { ok: false; error: string };

export type TrashItem = {
  id: string;
  title: string;
  type: string;
  space_id: string;
  spaceName: string;
  deleted_at: string;
  count: number; // total de nós na subárvore (inclui o próprio)
};

/**
 * Lista as RAÍZES das subárvores excluídas (não polui com cada filho).
 * Uma raiz é um nó excluído cujo pai não está excluído.
 */
export async function listTrash(): Promise<TrashItem[]> {
  const supabase = await createClient();
  const { data: deleted } = await supabase
    .from("nodes")
    .select("id, parent_id, title, type, space_id, deleted_at, path")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });
  const rows = deleted ?? [];
  const deletedIds = new Set(rows.map((r) => r.id));

  const { data: spaces } = await supabase.from("spaces").select("id, name");
  const spaceName = new Map((spaces ?? []).map((s) => [s.id, s.name]));

  const roots = rows.filter((r) => !r.parent_id || !deletedIds.has(r.parent_id));
  return roots.map((r) => {
    const prefix = `${r.path}.`;
    const count = 1 + rows.filter((n) => n.id !== r.id && String(n.path).startsWith(prefix)).length;
    return {
      id: r.id,
      title: r.title,
      type: r.type,
      space_id: r.space_id,
      spaceName: spaceName.get(r.space_id) ?? "?",
      deleted_at: r.deleted_at as string,
      count,
    };
  });
}

/** Restaura a subárvore inteira no lugar de origem (hierarquia + ordem). */
export async function restoreTrash(nodeId: string): Promise<TrashResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("restore_subtree", { p_node_id: nodeId });
  if (error) {
    return {
      ok: false,
      error: error.message.includes("permiss")
        ? "Sem permissão para restaurar."
        : `Falha ao restaurar: ${error.message}`,
    };
  }
  await audit({ action: "content.restore_subtree", entityType: "node", entityId: nodeId, after: { count: data } });
  revalidatePath("/admin/lixeira");
  revalidatePath("/admin/conteudo");
  return { ok: true, count: data ?? 0 };
}

/** Exclui DEFINITIVAMENTE a subárvore da lixeira (irreversível). */
export async function hardDeleteTrash(nodeId: string): Promise<TrashResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("hard_delete_subtree", { p_node_id: nodeId });
  if (error) {
    return {
      ok: false,
      error: error.message.includes("permiss")
        ? "Sem permissão para esvaziar a lixeira."
        : `Falha: ${error.message}`,
    };
  }
  await audit({ action: "trash.hard_delete", entityType: "node", entityId: nodeId, after: { count: data } });
  revalidatePath("/admin/lixeira");
  return { ok: true, count: data ?? 0 };
}

/** Esvazia a lixeira: exclui definitivamente todas as raízes excluídas. */
export async function emptyTrash(): Promise<TrashResult> {
  const roots = await listTrash();
  let total = 0;
  for (const r of roots) {
    const res = await hardDeleteTrash(r.id);
    if (!res.ok) return res;
    total += res.count ?? 0;
  }
  revalidatePath("/admin/lixeira");
  return { ok: true, count: total };
}
