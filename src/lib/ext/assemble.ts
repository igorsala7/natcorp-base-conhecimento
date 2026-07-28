import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { generateKeyBetween } from "fractional-indexing";
import { createAdminClient } from "@/lib/supabase/admin";
import { uniqueSlug } from "@/lib/content/unique-slug";
import { newId, type Block, type BlockDoc } from "@/lib/blocks/schema";
import { midiaParaBloco, type MediaRef } from "@/lib/studio/media";
import { montarItensTimeline, planejarBlocos, type TrailEvent } from "./timeline";

/**
 * Monta um RASCUNHO de artigo a partir da trilha capturada pela extensão
 * (Fase 5.2). Determinístico e sem IA: navegação, prints e narração são postos
 * na LINHA DO TEMPO (`timeline.ts`) e viram blocos aqui — o único I/O é
 * re-hospedar cada print do bucket privado no público. A redação pela IA é o
 * próximo refino.
 *
 * Roda por service-role (a extensão autentica por token, não por sessão). A
 * permissão de autoria é conferida ANTES, na rota (`has_permission`).
 */
export type { TrailEvent };

const heading = (level: 1 | 2 | 3, txt: string): Block => ({
  id: newId(),
  type: "heading",
  text: [{ text: txt }],
  data: { level },
});
const paragrafo = (txt: string): Block => ({ id: newId(), type: "paragraph", text: [{ text: txt }] });

/** Copia um print do bucket privado 'imports' para o público 'assets'. */
export async function reHospedarPrint(spaceId: string, storagePath: string, alt: string): Promise<MediaRef | null> {
  const supabase = createAdminClient();
  const dl = await supabase.storage.from("imports").download(storagePath);
  if (dl.error || !dl.data) return null;
  const buf = Buffer.from(await dl.data.arrayBuffer());
  const checksum = createHash("sha256").update(buf).digest("hex");
  const path = `${spaceId}/ext/${checksum}.png`;
  const up = await supabase.storage.from("assets").upload(path, buf, { contentType: "image/png", upsert: true });
  if (up.error) return null;
  const url = supabase.storage.from("assets").getPublicUrl(path).data.publicUrl;
  if (!url) return null;
  return { id: randomUUID().replace(/-/g, "").slice(0, 8), kind: "image", url, name: alt || "Print", alt: alt || "" };
}

/**
 * Trilha → BlockDoc navegável, montado na LINHA DO TEMPO (req. 3). A ordem é
 * decidida por `planejarBlocos` (puro, testável); aqui só re-hospedamos cada
 * print e materializamos o plano em blocos.
 */
export async function montarRascunho(spaceId: string, eventos: TrailEvent[]): Promise<BlockDoc> {
  const plano = planejarBlocos(montarItensTimeline(eventos));
  const blocks: Block[] = [];
  for (const p of plano) {
    if (p.kind === "heading") blocks.push(heading(2, p.text));
    else if (p.kind === "paragraph") blocks.push(paragrafo(p.text));
    else {
      const midia = await reHospedarPrint(spaceId, p.storagePath, p.title);
      if (midia) blocks.push(midiaParaBloco(midia));
    }
  }
  return { version: 2, blocks };
}

/** Cria o nó de artigo RASCUNHO (service-role). A permissão já foi conferida. */
export async function criarNoRascunho(
  userId: string,
  spaceId: string,
  parentId: string | null,
  title: string,
  doc: BlockDoc,
): Promise<{ ok: true; nodeId: string } | { ok: false; error: string }> {
  const supabase = createAdminClient();

  let q = supabase
    .from("nodes")
    .select("position")
    .eq("space_id", spaceId)
    .is("deleted_at", null)
    .order("position", { ascending: false })
    .limit(1);
  q = parentId ? q.eq("parent_id", parentId) : q.is("parent_id", null);
  const { data: last } = await q.maybeSingle();
  const position = generateKeyBetween((last?.position as string | null) ?? null, null);

  const slug = await uniqueSlug(supabase, spaceId, parentId, title);

  const { data: node, error } = await supabase
    .from("nodes")
    .insert({ space_id: spaceId, parent_id: parentId, type: "article", title, slug, position })
    .select("id")
    .single();
  if (error || !node) return { ok: false, error: error?.message ?? "Falha ao criar o nó." };

  const { error: aErr } = await supabase.from("articles").insert({ node_id: node.id, content_json: doc as never });
  if (aErr) return { ok: false, error: aErr.message };

  // Auditoria (sem sessão Supabase — insere direto).
  await supabase.from("audit_log").insert({
    actor_id: userId,
    action: "content.create",
    entity_type: "node",
    entity_id: node.id,
    space_id: spaceId,
    after: { via: "extension" } as never,
  });

  return { ok: true, nodeId: node.id };
}
