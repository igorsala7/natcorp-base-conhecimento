"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";
import { audit } from "@/lib/auth/audit";
import { reindexNodeChunks } from "@/lib/content/chunk";
import type { Json } from "@/lib/database.types";

export type SaveResult = { ok: true } | { ok: false; error: string };

/** Extrai texto puro de um documento TipTap (para excerpt/busca). */
function extractText(doc: unknown): string {
  const parts: string[] = [];
  const walk = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    const node = n as { text?: string; content?: unknown[] };
    if (typeof node.text === "string") parts.push(node.text);
    if (Array.isArray(node.content)) node.content.forEach(walk);
  };
  walk(doc);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

async function spaceIdOfNode(
  supabase: Awaited<ReturnType<typeof createClient>>,
  nodeId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("nodes")
    .select("space_id")
    .eq("id", nodeId)
    .single();
  return data?.space_id ?? null;
}

/** Salva o conteúdo do artigo (rascunho). content_json é a fonte da verdade. */
export async function saveArticle(
  nodeId: string,
  contentJson: unknown,
): Promise<SaveResult> {
  const supabase = await createClient();
  const spaceId = await spaceIdOfNode(supabase, nodeId);
  if (!spaceId) return { ok: false, error: "Nó não encontrado." };
  try {
    await requirePermission("content.edit", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão para editar." };
  }

  const text = extractText(contentJson);
  const excerpt = text.slice(0, 200);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: updated, error } = await supabase
    .from("articles")
    .update({
      content_json: contentJson as Json,
      content_text: text,
      excerpt,
      updated_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("node_id", nodeId)
    .select("id")
    .single();
  if (error) return { ok: false, error: `Falha ao salvar: ${error.message}` };

  // Reindexa os chunks para a busca (idempotente).
  if (updated) {
    await reindexNodeChunks(supabase, {
      nodeId,
      articleId: updated.id,
      spaceId,
      doc: contentJson as { type: string; content?: never[] },
    });
  }

  return { ok: true };
}

/** Publica o nó (exige content.publish). content_html será gerado na Fase 2. */
export async function publishNode(nodeId: string): Promise<SaveResult> {
  const supabase = await createClient();
  const spaceId = await spaceIdOfNode(supabase, nodeId);
  if (!spaceId) return { ok: false, error: "Nó não encontrado." };
  try {
    await requirePermission("content.publish", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão para publicar." };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("nodes")
    .update({ status: "published", published_at: now })
    .eq("id", nodeId);
  if (error) return { ok: false, error: `Falha: ${error.message}` };

  await supabase
    .from("articles")
    .update({ published_at: now })
    .eq("node_id", nodeId);

  await audit({
    action: "content.publish",
    entityType: "node",
    entityId: nodeId,
    spaceId,
  });
  revalidatePath("/admin/conteudo");
  return { ok: true };
}

/** Despublica (volta para rascunho). Exige content.publish. */
export async function unpublishNode(nodeId: string): Promise<SaveResult> {
  const supabase = await createClient();
  const spaceId = await spaceIdOfNode(supabase, nodeId);
  if (!spaceId) return { ok: false, error: "Nó não encontrado." };
  try {
    await requirePermission("content.publish", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão para despublicar." };
  }

  const { error } = await supabase
    .from("nodes")
    .update({ status: "draft", published_at: null })
    .eq("id", nodeId);
  if (error) return { ok: false, error: `Falha: ${error.message}` };

  await audit({
    action: "content.unpublish",
    entityType: "node",
    entityId: nodeId,
    spaceId,
  });
  revalidatePath("/admin/conteudo");
  return { ok: true };
}
