import "server-only";
import { embed } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";
import {
  embeddingModel,
  embeddingCallOptions,
  hasEmbeddingKey,
  aiTimeout,
} from "@/lib/ai/config";
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
  /**
   * O MANUAL de origem: título do diretório de 1º nível do artigo (numa
   * documentação com 20 PDFs importados, é o nome do manual). Nulo quando o
   * artigo está na raiz ou a fonte é um arquivo (o title já identifica).
   * Vai para o bloco de contexto — é o que permite ao modelo NÃO misturar.
   */
  origin: string | null;
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
  // Título do diretório de 1º nível de cada nó — o "manual" a que ele pertence.
  const rootTitleById = new Map<string, string | null>();
  const nodeIds: string[] = [];
  const walk = (list: EffectiveNode[], prefix: string[], rootTitle: string | null) => {
    for (const n of list) {
      const p = [...prefix, n.slug];
      basePathById.set(n.id, `/docs/${slug}/${p.join("/")}`);
      // Nó de 1º nível é o próprio manual: origem nula (o title já identifica).
      rootTitleById.set(n.id, rootTitle);
      nodeIds.push(n.id);
      walk(n.children, p, rootTitle ?? n.title);
    }
  };
  walk(tree, [], null);
  return { nodeIds, basePathById, rootTitleById };
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
  const rootTitleById = new Map<string, string | null>();
  for (const e of escopos) {
    const ctx = await spaceContext(supabase, e.spaceId, e.tree);
    nodeIds.push(...ctx.nodeIds);
    for (const [id, path] of ctx.basePathById) basePathById.set(id, path);
    for (const [id, t] of ctx.rootTitleById) rootTitleById.set(id, t);
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
  if (await hasEmbeddingKey()) {
    try {
      const { embedding: e } = await embed({
        model: await embeddingModel(),
        value: query,
        // Dimensão vai na CHAMADA neste SDK, não no modelo. Sem isto, um
        // modelo de 3072 devolveria vetor que a coluna vector(1536) recusa.
        providerOptions: await embeddingCallOptions(),
        // Curto de propósito: está no caminho de TODA busca do RAG. Provedor
        // lento aqui degrada para busca léxica em vez de travar a resposta.
        abortSignal: aiTimeout("embedding_query"),
      });
      embedding = e;
    } catch (e) {
      // Antes era um catch mudo: a busca virava só-léxica sem nenhum sinal.
      console.error(
        "[rag] embedding da pergunta falhou, caindo para busca léxica:",
        e instanceof Error ? e.message : e,
      );
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
        origin: null,
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
      origin: rootTitleById.get(r.node_id) ?? null,
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
  // O client admin precisa ir junto: sem ele getEffectiveTreePublic cai no
  // cliente anon, e a policy nodes_public_read exige visibility='public' — o
  // escopo voltava VAZIO justamente nos espaços privados vinculados à chave.
  const escopos = await Promise.all(
    ids.map(async (spaceId) => ({
      spaceId,
      tree: await getEffectiveTreePublic(spaceId, supabase),
    })),
  );
  return retrieveWith(supabase, escopos, query, limit);
}

/**
 * Monta o bloco de contexto numerado para o prompt.
 *
 * Cada fonte declara o MANUAL de origem antes do título ("Manual X › Artigo").
 * É esse rótulo que a regra anti-mistura do prompt referencia — sem ele, o
 * modelo não teria como saber que dois trechos parecidos vêm de manuais
 * diferentes.
 */
export function buildContextBlock(sources: RetrievedSource[]): string {
  return sources
    .map((s) => {
      const origem = s.origin && s.origin !== s.title ? `${s.origin} › ` : "";
      return `[${s.n}] ${origem}${s.title}${s.heading_path ? ` — ${s.heading_path}` : ""}\n${s.content}`;
    })
    .join("\n\n---\n\n");
}

// O system prompt vive em `@/lib/ai/prompt-cascade`: ele depende da
// personalização por chave e por documentação, e precisa reanexar as regras
// absolutas depois do texto do usuário. Duas verdades sobre o prompt seria o
// caminho mais curto para o chatbot alucinar em uma das telas.
