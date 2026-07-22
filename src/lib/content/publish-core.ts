import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { reindexNodeChunks } from "@/lib/content/chunk";
import { normalizeDoc } from "@/lib/blocks/convert";
import { blocksToText } from "@/lib/blocks/serialize";

/**
 * Núcleo de publicar/despublicar, SEM permissão/auditoria/revalidate — essas
 * responsabilidades ficam em quem chama: a Server Action (usuário logado) ou o
 * worker de agendamento (service-role, `server-only` stubado). Uma lógica só:
 * se a publicação agendada divergisse da manual, seria bug esperando data.
 */
export type PublishDb = SupabaseClient<Database>;

/** Extrai texto puro do documento (blocos v2 ou TipTap legado). */
export function extractText(doc: unknown): string {
  return blocksToText(normalizeDoc(doc).blocks);
}

/**
 * Se houver rascunho pendente (tabela `article_drafts`), promove-o a
 * `content_json` (a versão oficial), recalcula texto/excerpt e apaga o rascunho.
 * Retorna se comitou algo. Usado ao publicar/aprovar/despublicar.
 */
export async function commitDraftIfAny(db: PublishDb, nodeId: string): Promise<boolean> {
  const { data: draft } = await db
    .from("article_drafts")
    .select("content_json")
    .eq("node_id", nodeId)
    .maybeSingle();
  if (!draft) return false;
  const text = extractText(draft.content_json);
  await db
    .from("articles")
    .update({
      content_json: draft.content_json,
      content_text: text,
      excerpt: text.slice(0, 200),
    })
    .eq("node_id", nodeId);
  await db.from("article_drafts").delete().eq("node_id", nodeId);
  return true;
}

export type CoreResult = { ok: true } | { ok: false; error: string };

/**
 * Publica um nó: rascunho vira oficial, status muda, snapshot de versão e
 * reindex com embeddings (a falha do reindex NÃO desfaz a publicação — sem
 * chave de IA o conteúdo ainda precisa ir ao ar; regenera-se depois).
 */
export async function publishNodeCore(
  db: PublishDb,
  nodeId: string,
  spaceId: string,
  versionLabel = "Publicação",
): Promise<CoreResult> {
  await commitDraftIfAny(db, nodeId);

  const now = new Date().toISOString();
  const { error } = await db
    .from("nodes")
    .update({ status: "published", published_at: now, publish_at: null })
    .eq("id", nodeId);
  if (error) return { ok: false, error: `Falha: ${error.message}` };

  await db.from("articles").update({ published_at: now }).eq("node_id", nodeId);

  // Snapshot obrigatório a cada publicação (histórico append-only).
  await db.rpc("create_article_version", { p_node_id: nodeId, p_label: versionLabel });

  const { data: art } = await db
    .from("articles")
    .select("id, content_json")
    .eq("node_id", nodeId)
    .maybeSingle();
  if (art) {
    try {
      await reindexNodeChunks(db, {
        nodeId,
        articleId: art.id,
        spaceId,
        doc: art.content_json as { type: string; content?: never[] },
        withEmbeddings: true,
      });
    } catch {
      // Publicado fica publicado; embeddings são regeneráveis pela UI.
    }
  }
  return { ok: true };
}

/**
 * Despublica um nó preservando edições pendentes. Se `redirectToNodeId` vier,
 * grava um redirect do caminho público atual para o destino — link
 * compartilhado nunca pode quebrar (regra de ouro do produto).
 */
export async function unpublishNodeCore(
  db: PublishDb,
  nodeId: string,
  spaceId: string,
  redirectToNodeId: string | null,
): Promise<CoreResult> {
  if (redirectToNodeId && redirectToNodeId !== nodeId) {
    const fromPath = await slugPathOf(db, spaceId, nodeId);
    if (fromPath) {
      await db
        .from("redirects")
        .upsert(
          { space_id: spaceId, from_path: fromPath, to_node_id: redirectToNodeId },
          { onConflict: "space_id,from_path" },
        );
    }
  }

  await commitDraftIfAny(db, nodeId);
  const { error } = await db
    .from("nodes")
    .update({ status: "draft", published_at: null, unpublish_at: null, unpublish_redirect_to: null })
    .eq("id", nodeId);
  if (error) return { ok: false, error: `Falha: ${error.message}` };
  return { ok: true };
}

/** Caminho de slugs (sem barra inicial) subindo pelos pais. */
async function slugPathOf(db: PublishDb, spaceId: string, nodeId: string): Promise<string | null> {
  const { data: nodes } = await db
    .from("nodes")
    .select("id, parent_id, slug")
    .eq("space_id", spaceId)
    .is("deleted_at", null);
  const porId = new Map((nodes ?? []).map((n) => [n.id, n]));
  const partes: string[] = [];
  let atual = porId.get(nodeId);
  let guarda = 0;
  while (atual && guarda++ < 50) {
    partes.unshift(atual.slug);
    atual = atual.parent_id ? porId.get(atual.parent_id) : undefined;
  }
  return partes.length ? partes.join("/") : null;
}
