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

/**
 * Publica as PASTAS ancestrais ainda em rascunho. Um nó publicado cujo ancestral
 * NÃO está publicado é PODADO do portal (some — ver getPortalTree). Publicar
 * conteúdo deve tornar o CAMINHO até ele visível; sem isto, publicar um artigo
 * dentro de uma pasta em rascunho o deixava invisível no portal. Só age ao
 * PUBLICAR (nunca ao despublicar), então "despublicar pasta para esconder a
 * seção" continua valendo. Sobe nó a nó (nunca lê a árvore inteira, que estoura
 * o teto de 1000 linhas do PostgREST). Best-effort: a RLS de `nodes` exige
 * `content.edit` no ancestral — um editor com escopo de subárvore não publica
 * pastas ACIMA do seu escopo (esse caso segue dependendo de quem tem permissão).
 */
export async function publishAncestors(db: PublishDb, nodeId: string): Promise<void> {
  const now = new Date().toISOString();
  let cursor = nodeId;
  for (let i = 0; i < 60; i++) {
    const atual = await db.from("nodes").select("parent_id").eq("id", cursor).maybeSingle();
    const parentId = atual.data?.parent_id;
    if (!parentId) break;
    const pai = await db.from("nodes").select("status").eq("id", parentId).maybeSingle();
    if (pai.data && pai.data.status !== "published") {
      await db.from("nodes").update({ status: "published", published_at: now, publish_at: null }).eq("id", parentId);
    }
    cursor = parentId;
  }
}

export type CoreResult = { ok: true } | { ok: false; error: string };

/**
 * Publica um nó: rascunho vira oficial, status muda, snapshot de versão e
 * reindex (a falha do reindex NÃO desfaz a publicação — sem chave de IA o
 * conteúdo ainda precisa ir ao ar; regenera-se depois).
 *
 * Embeddings:
 *  - com `opts.enqueueEmbedding` (server action): faz só o rápido/confiável —
 *    chunk SEM vetores (a busca léxica já funciona) e delega os embeddings ao
 *    worker (com retentativa). Evita o timeout ao publicar artigo grande/pasta.
 *  - sem callback (worker de agendamento/lote, processo longo sem timeout):
 *    gera os embeddings inline, como antes.
 */
export async function publishNodeCore(
  db: PublishDb,
  nodeId: string,
  spaceId: string,
  versionLabel = "Publicação",
  opts?: { enqueueEmbedding?: (nodeId: string, spaceId: string) => Promise<void> },
): Promise<CoreResult> {
  await commitDraftIfAny(db, nodeId);

  const now = new Date().toISOString();
  const { error } = await db
    .from("nodes")
    .update({ status: "published", published_at: now, publish_at: null })
    .eq("id", nodeId);
  if (error) return { ok: false, error: `Falha: ${error.message}` };

  await db.from("articles").update({ published_at: now }).eq("node_id", nodeId);

  // Torna o CAMINHO visível: publica pastas ancestrais em rascunho — senão o
  // portal poda este nó (publicado sob pai não-publicado) e ele some.
  await publishAncestors(db, nodeId);

  // Snapshot obrigatório a cada publicação (histórico append-only).
  await db.rpc("create_article_version", { p_node_id: nodeId, p_label: versionLabel });

  const { data: art } = await db
    .from("articles")
    .select("id, content_json")
    .eq("node_id", nodeId)
    .maybeSingle();
  if (art) {
    const doc = art.content_json as { type: string; content?: never[] };
    try {
      // Léxico já: com fila, só chunk (vetores vêm depois); sem fila, inline.
      await reindexNodeChunks(db, {
        nodeId,
        articleId: art.id,
        spaceId,
        doc,
        withEmbeddings: !opts?.enqueueEmbedding,
      });
    } catch {
      // Publicado fica publicado; embeddings são regeneráveis pela UI.
    }
    if (opts?.enqueueEmbedding) {
      try {
        await opts.enqueueEmbedding(nodeId, spaceId);
      } catch {
        // Fila indisponível não desfaz a publicação — regenerável pela UI.
      }
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
