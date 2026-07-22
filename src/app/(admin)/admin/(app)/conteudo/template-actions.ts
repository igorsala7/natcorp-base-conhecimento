"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/permissions";
import { audit } from "@/lib/auth/audit";
import { normalizeDoc } from "@/lib/blocks/convert";
import { BlockDocSchema, newId, type Block } from "@/lib/blocks/schema";
import { slugify } from "@/lib/content/slug";
import type { Json } from "@/lib/database.types";

export type TemplateOption = { id: string; name: string; description: string | null };
export type TemplateResult = { ok: true } | { ok: false; error: string };

/** Modelos SALVOS da documentação (os embutidos vivem no código). */
export async function listSavedTemplates(spaceId: string): Promise<TemplateOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("article_templates")
    .select("id, name, description")
    .eq("space_id", spaceId)
    .order("name");
  return data ?? [];
}

/** Blocos de um modelo salvo, com ids NOVOS a cada uso. */
export async function getTemplateBlocks(templateId: string): Promise<Block[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("article_templates")
    .select("blocks")
    .eq("id", templateId)
    .maybeSingle();
  const doc = normalizeDoc({ version: 2, blocks: (data?.blocks as Block[]) ?? [] });
  const renovar = (bs: Block[]): Block[] =>
    bs.map((b) => ({
      ...b,
      id: newId(),
      ...("children" in b && b.children
        ? { children: renovar(b.children as Block[]) }
        : {}),
    })) as Block[];
  return renovar(doc.blocks);
}

/** "Salvar artigo como modelo": congela o conteúdo ATUAL (rascunho primeiro). */
export async function saveArticleAsTemplate(
  nodeId: string,
  name: string,
  description: string | null,
): Promise<TemplateResult> {
  const parsed = z.string().trim().min(1).max(80).safeParse(name);
  if (!parsed.success) return { ok: false, error: "Nome inválido." };
  const supabase = await createClient();
  const { data: node } = await supabase
    .from("nodes")
    .select("space_id")
    .eq("id", nodeId)
    .single();
  if (!node) return { ok: false, error: "Artigo não encontrado." };
  try {
    await requirePermission("content.edit", node.space_id);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }

  const [{ data: draft }, { data: article }] = await Promise.all([
    supabase.from("article_drafts").select("content_json").eq("node_id", nodeId).maybeSingle(),
    supabase.from("articles").select("content_json").eq("node_id", nodeId).maybeSingle(),
  ]);
  const doc = normalizeDoc(draft?.content_json ?? article?.content_json);
  if (!doc.blocks.length) return { ok: false, error: "Artigo vazio — nada a salvar." };
  const valido = BlockDocSchema.safeParse(doc);
  if (!valido.success) return { ok: false, error: "Conteúdo inválido." };

  const { error } = await supabase.from("article_templates").insert({
    space_id: node.space_id,
    name: parsed.data,
    description: description?.trim() || null,
    blocks: doc.blocks as unknown as Json,
    created_by: (await supabase.auth.getUser()).data.user?.id ?? null,
  });
  if (error) return { ok: false, error: `Falha: ${error.message}` };
  await audit({
    action: "content.template_save",
    entityType: "node",
    entityId: nodeId,
    spaceId: node.space_id,
    after: { name: parsed.data },
  });
  return { ok: true };
}

/** "Salvar seleção como snippet": trecho reutilizável por transclusão. */
export async function saveBlocksAsSnippet(
  spaceId: string,
  title: string,
  blocks: Block[],
): Promise<TemplateResult> {
  const parsed = z.string().trim().min(1).max(80).safeParse(title);
  if (!parsed.success) return { ok: false, error: "Nome inválido." };
  try {
    await requirePermission("content.edit", spaceId);
  } catch {
    return { ok: false, error: "Sem permissão." };
  }
  const doc = { version: 2 as const, blocks };
  const valido = BlockDocSchema.safeParse(doc);
  if (!valido.success || !blocks.length) return { ok: false, error: "Seleção inválida." };
  const key = slugify(parsed.data);
  if (!key) return { ok: false, error: "Nome inválido." };

  const supabase = await createClient();
  const { error } = await supabase.from("snippets").upsert(
    {
      space_id: spaceId,
      key,
      title: parsed.data,
      content_json: doc as unknown as Json,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "space_id,key" },
  );
  if (error) return { ok: false, error: `Falha: ${error.message}` };
  await audit({
    action: "content.snippet_save",
    entityType: "snippet",
    entityId: key,
    spaceId,
  });
  return { ok: true };
}

/** Snippets da documentação (para o slash menu inserir por nome). */
export async function listSnippets(
  spaceId: string,
): Promise<{ key: string; title: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("snippets")
    .select("key, title")
    .eq("space_id", spaceId)
    .order("title");
  return data ?? [];
}
