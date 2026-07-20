import "server-only";
import { embed } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";
import { embeddingModel, hasEmbeddingKey } from "@/lib/ai/config";
import {
  getEffectiveTreeAdmin,
  getEffectiveTreePublic,
  type EffectiveNode,
} from "@/lib/content/overlays";
import { slugify } from "@/lib/content/slug";
import { firstImageOf } from "@/lib/blocks/serialize";

type DbClient = SupabaseClient<Database>;

export type RetrievedSource = {
  n: number; // índice da citação [n]
  /** Nó do artigo. Nulo quando a fonte é um arquivo da base de conhecimento. */
  node_id: string | null;
  /** Documento da base. Nulo quando a fonte é um artigo. */
  document_id: string | null;
  title: string;
  heading_path: string | null;
  content: string;
  snippet: string | null; // trecho destacado (para busca)
  /** Link no portal (com âncora). Nulo quando a fonte não tem página. */
  url: string | null;
  image: string | null; // miniatura (capa do artigo ou 1ª imagem) — para os cards
};

/**
 * Nós efetivos + o CAMINHO PÚBLICO de cada nó, a partir de uma árvore resolvida.
 *
 * O caminho já sai com a slug do espaço embutida (`/docs/<slug>/a/b`) porque um
 * chatbot pode enxergar VÁRIAS documentações: guardar uma `spaceSlug` única e
 * montar a URL depois faria as citações da segunda documentação apontarem para
 * a primeira.
 */
async function spaceContext(
  supabase: DbClient,
  spaceId: string,
  tree: EffectiveNode[],
) {
  const { data: space } = await supabase
    .from("spaces")
    .select("slug")
    .eq("id", spaceId)
    .maybeSingle();
  const slug = space?.slug ?? "global";

  const basePathById = new Map<string, string>();
  const nodeIds: string[] = [];
  const walk = (list: EffectiveNode[], prefix: string[]) => {
    for (const n of list) {
      const p = [...prefix, n.slug];
      basePathById.set(n.id, `/docs/${slug}/${p.join("/")}`);
      nodeIds.push(n.id);
      walk(n.children, p);
    }
  };
  walk(tree, []);
  return { nodeIds, basePathById };
}

/**
 * Núcleo da recuperação: busca híbrida escopada pelos nós das árvores dadas.
 *
 * Recebe uma LISTA de (espaço, árvore) porque uma chave de widget pode cobrir
 * várias documentações. A fusão RRF continua inteira no Postgres — o escopo é
 * só a união dos nós, então nada de ranquear no cliente.
 */
async function retrieveWith(
  supabase: DbClient,
  escopos: { spaceId: string; tree: EffectiveNode[] }[],
  query: string,
  limit: number,
): Promise<RetrievedSource[]> {
  const nodeIds: string[] = [];
  const basePathById = new Map<string, string>();
  for (const e of escopos) {
    const ctx = await spaceContext(supabase, e.spaceId, e.tree);
    nodeIds.push(...ctx.nodeIds);
    for (const [id, path] of ctx.basePathById) basePathById.set(id, path);
  }

  // Arquivos da base de conhecimento dos MESMOS espaços do escopo. Só os
  // prontos: um documento ainda em extração tem chunks pela metade, e responder
  // com meia planilha é pior do que não responder.
  const { data: docs } = await supabase
    .from("knowledge_documents")
    .select("id")
    .in("space_id", escopos.map((e) => e.spaceId))
    .eq("status", "ready");
  const documentIds = (docs ?? []).map((d) => d.id);

  if (nodeIds.length === 0 && documentIds.length === 0) return [];

  let embedding: number[] | null = null;
  if (hasEmbeddingKey()) {
    try {
      const { embedding: e } = await embed({ model: embeddingModel(), value: query });
      embedding = e;
    } catch {
      embedding = null;
    }
  }

  const { data } = await supabase.rpc("hybrid_search_scoped", {
    p_query: query,
    p_embedding: embedding ? JSON.stringify(embedding) : undefined,
    // `undefined` (e não array vazio) quando não há escopo daquele tipo: a
    // função trata null como "sem filtro deste lado", e um array vazio faria
    // `= any('{}')` never matching, o que é o mesmo — mas explícito é melhor.
    p_node_ids: nodeIds.length ? nodeIds : undefined,
    p_document_ids: documentIds.length ? documentIds : undefined,
    p_limit: limit,
  });

  // Miniatura por nó citado: capa do artigo ou 1ª imagem do conteúdo.
  // Chunk de arquivo não tem nó — fica de fora daqui e cita sem miniatura.
  const hitNodeIds = (data ?? []).map((r) => r.node_id).filter((x): x is string => !!x);
  const imageByNode = new Map<string, string | null>();
  if (hitNodeIds.length) {
    const { data: arts } = await supabase
      .from("articles")
      .select("node_id, cover_image, content_json")
      .in("node_id", hitNodeIds);
    for (const a of arts ?? []) {
      imageByNode.set(a.node_id, a.cover_image ?? firstImageOf(a.content_json));
    }
  }

  return (data ?? []).map((r, i) => {
    // Fonte de ARQUIVO: não existe página no portal, então a citação sai sem
    // link. A UI já trata `url: null` (cartão sem âncora).
    if (!r.node_id) {
      return {
        n: i + 1,
        node_id: null,
        document_id: r.document_id,
        title: r.title ?? "Documento",
        heading_path: r.heading_path,
        content: r.content,
        snippet: r.snippet ?? null,
        url: null,
        image: null,
      } as RetrievedSource;
    }
    const base = basePathById.get(r.node_id) ?? "";
    const anchor = r.heading_path
      ? "#" + slugify(r.heading_path.split(" > ").pop() ?? "")
      : "";
    return {
      n: i + 1,
      node_id: r.node_id,
      document_id: null,
      title: r.title,
      heading_path: r.heading_path,
      content: r.content,
      snippet: r.snippet ?? null,
      url: base ? `${base}${anchor}` : null,
      image: imageByNode.get(r.node_id) ?? null,
    } as RetrievedSource;
  });
}

/**
 * Recupera os trechos mais relevantes para a pergunta, DENTRO do espaço.
 * Caminho AUTENTICADO (admin/portal): usa a sessão e a árvore completa.
 */
export async function retrieveContext(
  spaceId: string,
  query: string,
  limit = 8,
): Promise<RetrievedSource[]> {
  const supabase = await createClient();
  const tree = await getEffectiveTreeAdmin(spaceId);
  return retrieveWith(supabase as DbClient, [{ spaceId, tree }], query, limit);
}

/**
 * Caminho PÚBLICO (widget / API v1): sem sessão. Escopo = árvore pública do
 * espaço (só publicado, respeitando overlays). Usa service-role para ler os
 * chunks e escrever conversas mesmo em espaços privados vinculados à chave.
 */
export async function retrievePublicContext(
  spaceIds: string | string[],
  query: string,
  limit = 8,
): Promise<RetrievedSource[]> {
  const supabase = createAdminClient();
  const ids = Array.isArray(spaceIds) ? spaceIds : [spaceIds];
  const escopos = await Promise.all(
    ids.map(async (spaceId) => ({ spaceId, tree: await getEffectiveTreePublic(spaceId) })),
  );
  return retrieveWith(supabase, escopos, query, limit);
}

/** Monta o bloco de contexto numerado para o prompt. */
export function buildContextBlock(sources: RetrievedSource[]): string {
  return sources
    .map(
      (s) =>
        `[${s.n}] ${s.title}${s.heading_path ? ` — ${s.heading_path}` : ""}\n${s.content}`,
    )
    .join("\n\n---\n\n");
}

// O system prompt vive em `@/lib/ai/prompt-cascade`: ele depende da
// personalização por chave e por documentação, e precisa reanexar as regras
// absolutas depois do texto do usuário. Duas verdades sobre o prompt seria o
// caminho mais curto para o chatbot alucinar em uma das telas.
