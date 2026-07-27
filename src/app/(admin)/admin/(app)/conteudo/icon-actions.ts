"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";
import { audit } from "@/lib/auth/audit";
import { fetchAllPaged } from "@/lib/supabase/paginate";
import { iconePorContexto } from "@/lib/blocks/icon-suggest";
import { escolherIcones, type DiretorioParaIcone } from "@/lib/ai/icon-scan";

type NodeMini = {
  id: string;
  parent_id: string | null;
  title: string;
  type: string;
  icon: string | null;
};

export type DefinirIconesResult =
  | { ok: true; definidos: number; total: number; comIa: boolean }
  | { ok: false; error: string };

/**
 * Percorre TODOS os diretórios da documentação e define um ícone para cada um
 * que ainda NÃO tem, a partir do contexto (título do diretório + títulos dos
 * itens dentro dele). A IA do Chat escolhe pelo tema; a heurística
 * (`iconePorContexto`) cobre o que a IA não resolver ou quando não há IA.
 * Nunca sobrescreve um ícone já definido (manual ou anterior).
 */
export async function definirIconesDiretorios(spaceId: string): Promise<DefinirIconesResult> {
  try {
    await requirePermission("content.edit", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão para editar." };
  }
  const supabase = await createClient();

  const nodes = await fetchAllPaged<NodeMini>((from, to) =>
    supabase
      .from("nodes")
      .select("id, parent_id, title, type, icon")
      .eq("space_id", spaceId)
      .order("id", { ascending: true })
      .range(from, to),
  );

  // Títulos dos filhos por pai (para dar contexto ao diretório).
  const filhosPorPai = new Map<string, string[]>();
  for (const n of nodes) {
    if (!n.parent_id) continue;
    const lista = filhosPorPai.get(n.parent_id) ?? [];
    lista.push(n.title);
    filhosPorPai.set(n.parent_id, lista);
  }

  // Só diretórios SEM ícone — não pisa em escolhas já feitas.
  const alvos = nodes.filter((n) => n.type === "folder" && !n.icon);
  if (!alvos.length) return { ok: true, definidos: 0, total: 0, comIa: false };

  const itens: DiretorioParaIcone[] = alvos.map((f) => ({
    id: f.id,
    titulo: f.title,
    filhos: filhosPorPai.get(f.id) ?? [],
  }));

  // IA escolhe pelo contexto; a heurística preenche o restante.
  const daIa = await escolherIcones(itens);
  const comIa = daIa.size > 0;

  const escolha = new Map<string, string>();
  for (const it of itens) {
    const key = daIa.get(it.id) ?? iconePorContexto(it.titulo, it.filhos);
    if (key) escolha.set(it.id, key);
  }
  if (!escolha.size) return { ok: true, definidos: 0, total: alvos.length, comIa };

  // Agrupa por ícone → 1 UPDATE por ícone (ids em fatias de 200). Atualiza por
  // id (os alvos já eram diretórios sem ícone — inclui `null` E `""`); a RLS de
  // `nodes` (has_permission_node) filtra o escopo do usuário.
  const idsPorIcone = new Map<string, string[]>();
  for (const [id, key] of escolha) {
    const lista = idsPorIcone.get(key) ?? [];
    lista.push(id);
    idsPorIcone.set(key, lista);
  }
  let definidos = 0;
  for (const [key, ids] of idsPorIcone) {
    for (let i = 0; i < ids.length; i += 200) {
      const fatia = ids.slice(i, i + 200);
      const { error, count } = await supabase
        .from("nodes")
        .update({ icon: key }, { count: "exact" })
        .in("id", fatia);
      if (!error) definidos += count ?? 0;
    }
  }

  await audit({
    action: "content.bulk_set_icons",
    entityType: "space",
    entityId: spaceId,
    spaceId,
    after: { definidos, total: alvos.length, comIa },
  });
  revalidatePath("/admin/conteudo");
  return { ok: true, definidos, total: alvos.length, comIa };
}
