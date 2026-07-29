import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateKeyBetween } from "fractional-indexing";
import { uniqueSlug } from "@/lib/content/unique-slug";
import { normalizeDoc } from "@/lib/blocks/convert";
import { extractText } from "@/lib/content/publish-core";
import type { BlockDoc } from "@/lib/blocks/schema";
import type { Database, Json } from "@/lib/database.types";

/**
 * Escrita de conteúdo via API de gestão (#5, fatia 2) — por SERVICE-ROLE (a rota
 * já checou o escopo). Reusa a lógica canônica: `path` (ltree) é setado por
 * trigger, `slug` único por (space,parent), `position` fracionária, e a REGRA DE
 * OURO: editar artigo PUBLICADO vai para rascunho (article_drafts) — a página
 * pública só muda no publish (que faz snapshot + reindex). Ver [[history-and-restore]].
 */

type Db = SupabaseClient<Database>;

export type CreateInput = { spaceId: string; parentId: string | null; title: string; contentJson?: unknown; text?: string };
export type UpdateInput = { title?: string; contentJson?: unknown; text?: string };
export type CreateResult = { ok: true; nodeId: string; slug: string } | { ok: false; status: number; error: string };
export type UpdateResult = { ok: true; draft: boolean } | { ok: false; status: number; error: string };

/** Documento de blocos a partir de content_json (bruto) OU text (plano). */
function buildDoc(contentJson: unknown, text: string | undefined): { doc: BlockDoc | null; texto: string } {
  if (contentJson != null) {
    const doc = normalizeDoc(contentJson);
    return { doc, texto: extractText(doc) };
  }
  if (text && text.trim()) {
    const legacy = {
      type: "doc",
      content: text.split(/\n{2,}/).map((p) => ({
        type: "paragraph",
        content: p.trim() ? [{ type: "text", text: p.trim() }] : [],
      })),
    };
    const doc = normalizeDoc(legacy);
    return { doc, texto: extractText(doc) };
  }
  return { doc: null, texto: "" };
}

export async function createArticleViaApi(db: Db, input: CreateInput): Promise<CreateResult> {
  const { spaceId, parentId, title } = input;
  if (parentId) {
    const { data: p } = await db
      .from("nodes")
      .select("id")
      .eq("id", parentId)
      .eq("space_id", spaceId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!p) return { ok: false, status: 400, error: "parent_id não pertence a este espaço." };
  }
  // position = fim da lista de irmãos.
  let q = db
    .from("nodes")
    .select("position")
    .eq("space_id", spaceId)
    .is("deleted_at", null)
    .order("position", { ascending: false })
    .limit(1);
  q = parentId ? q.eq("parent_id", parentId) : q.is("parent_id", null);
  const { data: last } = await q.maybeSingle();
  const position = generateKeyBetween(last?.position ?? null, null);
  const slug = await uniqueSlug(db, spaceId, parentId, title);

  const { data: node, error } = await db
    .from("nodes")
    .insert({ space_id: spaceId, parent_id: parentId, type: "article", title: title.trim(), slug, position })
    .select("id, slug")
    .single();
  if (error || !node) return { ok: false, status: 500, error: `Falha ao criar: ${error?.message ?? ""}` };

  const { doc, texto } = buildDoc(input.contentJson, input.text);
  await db.from("articles").insert({
    node_id: node.id,
    ...(doc ? { content_json: doc as unknown as Json, content_text: texto, excerpt: texto.slice(0, 200) } : {}),
  });
  return { ok: true, nodeId: node.id, slug: node.slug };
}

export async function updateArticleViaApi(db: Db, nodeId: string, input: UpdateInput): Promise<UpdateResult> {
  const { data: node } = await db.from("nodes").select("id, type, status").eq("id", nodeId).maybeSingle();
  if (!node) return { ok: false, status: 404, error: "Nó não encontrado." };
  if (node.type !== "article") return { ok: false, status: 400, error: "Só artigos podem ser editados por esta rota." };

  if (input.title != null && input.title.trim()) {
    await db.from("nodes").update({ title: input.title.trim() }).eq("id", nodeId);
  }

  const temConteudo = input.contentJson != null || input.text != null;
  if (!temConteudo) return { ok: true, draft: false };

  const { doc, texto } = buildDoc(input.contentJson, input.text);
  const content = (doc ?? normalizeDoc({ type: "doc", content: [] })) as unknown as Json;
  const now = new Date().toISOString();

  // Regra de ouro: artigo PUBLICADO → a edição vai para rascunho; a página
  // pública só muda quando chamarem /publish (commit do rascunho + snapshot).
  if (node.status === "published") {
    await db.from("article_drafts").upsert({ node_id: nodeId, content_json: content, updated_at: now }, { onConflict: "node_id" });
    return { ok: true, draft: true };
  }
  await db
    .from("articles")
    .update({ content_json: content, content_text: texto, excerpt: texto.slice(0, 200), updated_at: now })
    .eq("node_id", nodeId);
  return { ok: true, draft: false };
}
