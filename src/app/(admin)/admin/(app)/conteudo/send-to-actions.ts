"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";
import { fetchAllPaged } from "@/lib/supabase/paginate";
import { normalizeDoc } from "@/lib/blocks/convert";
import { cloneBlocksWithNewIds } from "@/lib/blocks/tree-ops";
import { saveArticle } from "./article-actions";
import { createNode } from "./actions";

/**
 * Copiar/Mover a SELEÇÃO de blocos para OUTRO artigo — existente ou novo (podendo
 * criar a estrutura de pastas). "Copiar" só acrescenta no destino; "Mover" é
 * copiar aqui + o editor remove os blocos da origem no cliente. Sempre CLONA os
 * blocos (ids novos) e usa `saveArticle` (respeita permissão e publicado→rascunho).
 */

/** Documentações que o usuário enxerga (RLS filtra). */
export async function listDestinationSpaces(): Promise<
  { id: string; name: string; type: string }[]
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("spaces")
    .select("id, name, type")
    .order("type")
    .order("name");
  return (data ?? []).map((s) => ({ id: s.id, name: s.name, type: s.type }));
}

/** Pastas + artigos de uma documentação (para navegar até o destino). */
export async function listDestinationNodes(
  spaceId: string,
): Promise<{ id: string; parent_id: string | null; type: string; title: string }[]> {
  try {
    await requirePermission("content.view", spaceId);
  } catch {
    return [];
  }
  const supabase = await createClient();
  type N = { id: string; parent_id: string | null; type: string; title: string; position: string };
  const rows = await fetchAllPaged<N>(async (from, to) => {
    const { data, error } = await supabase
      .from("nodes")
      .select("id, parent_id, type, title, position")
      .eq("space_id", spaceId)
      .in("type", ["folder", "article"])
      .is("deleted_at", null)
      .order("position")
      .order("id")
      .range(from, to);
    return { data: (data ?? null) as N[] | null, error };
  });
  return rows.map((n) => ({ id: n.id, parent_id: n.parent_id, type: n.type, title: n.title }));
}

const inputSchema = z.object({
  blocks: z.array(z.unknown()).min(1),
  mode: z.enum(["existing", "new"]),
  // existing
  targetNodeId: z.string().uuid().optional(),
  // new
  spaceId: z.string().uuid().optional(),
  parentId: z.string().uuid().nullable().optional(),
  folderPath: z.array(z.string().trim().min(1).max(120)).max(6).optional(),
  title: z.string().trim().min(1).max(200).optional(),
});

export type SendResult = { ok: true; nodeId: string } | { ok: false; error: string };

export async function sendSelectionToArticle(input: z.infer<typeof inputSchema>): Promise<SendResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };
  const p = parsed.data;

  // Clona com ids NOVOS (evita colidir com os blocos que já existem no destino).
  const doc = normalizeDoc({ version: 2, blocks: p.blocks });
  const novos = cloneBlocksWithNewIds(doc.blocks);
  if (!novos.length) return { ok: false, error: "Nada para enviar." };

  if (p.mode === "existing") {
    if (!p.targetNodeId) return { ok: false, error: "Escolha o artigo de destino." };
    const supabase = await createClient();
    const [{ data: draft }, { data: art }] = await Promise.all([
      supabase.from("article_drafts").select("content_json").eq("node_id", p.targetNodeId).maybeSingle(),
      supabase.from("articles").select("content_json").eq("node_id", p.targetNodeId).maybeSingle(),
    ]);
    if (!art && !draft) return { ok: false, error: "Artigo de destino não encontrado." };
    const atuais = normalizeDoc(draft?.content_json ?? art?.content_json).blocks;
    const res = await saveArticle(p.targetNodeId, { version: 2, blocks: [...atuais, ...novos] });
    if (!res.ok) return { ok: false, error: res.error };
    return { ok: true, nodeId: p.targetNodeId };
  }

  // mode === "new"
  if (!p.spaceId || !p.title) return { ok: false, error: "Escolha a documentação e o título." };
  let parentId: string | null = p.parentId ?? null;
  for (const nome of p.folderPath ?? []) {
    const r = await createNode({ spaceId: p.spaceId, parentId, type: "folder", title: nome });
    if (!r.ok || !r.id) return { ok: false, error: r.ok ? "Falha ao criar pasta." : r.error };
    parentId = r.id;
  }
  const rArt = await createNode({ spaceId: p.spaceId, parentId, type: "article", title: p.title });
  if (!rArt.ok || !rArt.id) return { ok: false, error: rArt.ok ? "Falha ao criar artigo." : rArt.error };
  const res = await saveArticle(rArt.id, { version: 2, blocks: novos });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, nodeId: rArt.id };
}
