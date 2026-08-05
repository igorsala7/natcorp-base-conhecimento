import "server-only";
import { embed } from "ai";
import { kvGetJson, kvSetJson, hashKey } from "@/lib/cache/kv";
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
import type { ClarifyScope } from "@/lib/ai/disambiguation";
import { expandirConsulta } from "@/lib/ai/ontology";
import { pedeEnumeracao, limparConsultaLista } from "@/lib/ai/answer-style";

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
  /** Documentação (espaço) da fonte — para agrupar por documentação. */
  space_id: string | null;
  space_name: string | null;
  /** Diretório de 1º nível (nó) e seu título — o "manual"; escopo/desambiguação. */
  dir_node_id: string | null;
  dir_title: string | null;
  /** Score da fusão RRF (soma dos sinais) — proxy de CONFIANÇA da recuperação. */
  score: number;
  /** Foi FORÇADA pelo vínculo termo→artigo da ontologia (sinal forte, alta confiança). */
  forced?: boolean;
};

/**
 * Nós efetivos + o CAMINHO PÚBLICO de cada nó, a partir de uma árvore resolvida.
 *
 * O caminho já sai com a slug do espaço embutida (`/docs/<slug>/a/b`) porque um
 * chatbot pode enxergar VÁRIAS documentações: guardar uma `spaceSlug` única e
 * montar a URL depois faria as citações da segunda documentação apontarem para
 * a primeira.
 */
/** Tema de um nó: documentação + diretório de 1º nível (o "manual"). */
type NodeTheme = { spaceId: string; spaceName: string; dirNodeId: string; dirTitle: string };

async function spaceContext(
  supabase: DbClient,
  spaceId: string,
  tree: EffectiveNode[],
) {
  const { data: space } = await supabase
    .from("spaces")
    .select("slug, name")
    .eq("id", spaceId)
    .maybeSingle();
  const slug = space?.slug ?? "global";
  const spaceName = space?.name ?? slug;

  const basePathById = new Map<string, string>();
  // Título do diretório de 1º nível de cada nó — o "manual" a que ele pertence.
  const rootTitleById = new Map<string, string | null>();
  // Tema completo por nó (documentação + diretório), para desambiguação/escopo.
  const themeByNode = new Map<string, NodeTheme>();
  const nodeIds: string[] = [];
  const walk = (
    list: EffectiveNode[],
    prefix: string[],
    rootTitle: string | null,
    rootId: string | null,
  ) => {
    for (const n of list) {
      // Nó OCULTO pelo cliente (overlay hidden) sai do escopo de busca — junto
      // com toda a subárvore. A árvore pública já vem podada; isto alinha o
      // assistente INTERNO (árvore de admin, que inclui ocultos) ao que o
      // chatbot real do cliente enxerga.
      if (n.hidden) continue;
      const p = [...prefix, n.slug];
      basePathById.set(n.id, `/docs/${slug}/${p.join("/")}`);
      // Nó de 1º nível é o próprio manual: origem nula (o title já identifica).
      rootTitleById.set(n.id, rootTitle);
      // Para o TEMA, o diretório de 1º nível nunca é nulo (nó de topo = ele mesmo).
      themeByNode.set(n.id, {
        spaceId,
        spaceName,
        dirNodeId: rootId ?? n.id,
        dirTitle: rootTitle ?? n.title,
      });
      nodeIds.push(n.id);
      walk(n.children, p, rootTitle ?? n.title, rootId ?? n.id);
    }
  };
  walk(tree, [], null, null);
  return { nodeIds, basePathById, rootTitleById, themeByNode };
}

/** Acha um nó por id na árvore efetiva (busca em profundidade). */
function findNode(list: EffectiveNode[], id: string): EffectiveNode | null {
  for (const n of list) {
    if (n.id === id) return n;
    const f = findNode(n.children, id);
    if (f) return f;
  }
  return null;
}

/** Ids do nó + toda a sua subárvore (para escopar a busca a um diretório). */
function subtreeIds(node: EffectiveNode): string[] {
  return [node.id, ...node.children.flatMap(subtreeIds)];
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
  scope?: ClarifyScope | null,
  lang?: string | null,
  lexicalOnly = false,
  grupos?: number,
): Promise<RetrievedSource[]> {
  // Escopo por DOCUMENTAÇÃO: restringe os espaços consultados (se bater em algum).
  const filtrados = scope?.spaceId ? escopos.filter((e) => e.spaceId === scope.spaceId) : escopos;
  const escoposUsar = filtrados.length ? filtrados : escopos;

  let nodeIds: string[] = [];
  const basePathById = new Map<string, string>();
  const rootTitleById = new Map<string, string | null>();
  const themeByNode = new Map<string, NodeTheme>();
  for (const e of escoposUsar) {
    const ctx = await spaceContext(supabase, e.spaceId, e.tree);
    nodeIds.push(...ctx.nodeIds);
    for (const [id, path] of ctx.basePathById) basePathById.set(id, path);
    for (const [id, t] of ctx.rootTitleById) rootTitleById.set(id, t);
    for (const [id, th] of ctx.themeByNode) themeByNode.set(id, th);
  }

  // Escopo por DIRETÓRIO: restringe aos nós da subárvore escolhida.
  if (scope?.nodeId) {
    let sub: string[] = [];
    for (const e of escoposUsar) {
      const node = findNode(e.tree, scope.nodeId);
      if (node) {
        sub = subtreeIds(node);
        break;
      }
    }
    if (sub.length) nodeIds = sub;
  }

  // Arquivos da base de conhecimento dos MESMOS espaços do escopo. Só os
  // prontos: um documento ainda em extração tem chunks pela metade, e responder
  // com meia planilha é pior do que não responder. Escopo por arquivo → só ele;
  // escopo por diretório de artigos → sem arquivos.
  let documentIds: string[];
  if (scope?.documentId) {
    documentIds = [scope.documentId];
    nodeIds = [];
  } else if (scope?.nodeId) {
    documentIds = [];
  } else {
    // HERANÇA: os arquivos de conhecimento do espaço-PAI (parent_space_id)
    // também valem para o cliente — igual à árvore e à ontologia. Assim um CSV
    // subido em "Documentação Natcorp" aparece nos widgets de Gestor/Colaborador
    // sem precisar reenviar (nem re-embeddar) em cada espaço.
    const escoposSpaceIds = escoposUsar.map((e) => e.spaceId);
    const { data: espacos } = await supabase
      .from("spaces")
      .select("id, parent_space_id")
      .in("id", escoposSpaceIds);
    const spaceIdsComPai = new Set(escoposSpaceIds);
    for (const s of espacos ?? []) if (s.parent_space_id) spaceIdsComPai.add(s.parent_space_id);
    const { data: docs } = await supabase
      .from("knowledge_documents")
      .select("id")
      .in("space_id", [...spaceIdsComPai])
      .eq("status", "ready");
    documentIds = (docs ?? []).map((d) => d.id);
  }

  if (nodeIds.length === 0 && documentIds.length === 0) return [];

  // Ontologia: expande a consulta ANTES do embedding. Devolve DUAS versões — a
  // LÉXICA (tsquery com os sinônimos) e a do VETOR (pergunta enriquecida com os
  // sinônimos casados), para a busca SEMÂNTICA também achar o conteúdo quando as
  // palavras exatas diferem. Degrada para a pergunta original se algo falhar.
  const { lexica: pQuery, vetor: queryVetor, boost, responsaveis } = await expandirConsulta(
    supabase,
    escoposUsar.map((e) => e.spaceId),
    query,
    lang,
  );

  let embedding: number[] | null = null;
  // lexicalOnly: pula o embedding da pergunta (chamada ao provedor, ~15s no pior caso
  // com cache frio) quando a busca semântica tem baixo valor — ex.: MODO RELATÓRIO, em
  // que a documentação já entra reduzida. A busca segue léxica (tsv + trigram + boost).
  if (!lexicalOnly && (await hasEmbeddingKey())) {
    // Cache do vetor da query (KV): a MESMA pergunta (mesmo espaço/sinônimos)
    // reaproveita o embedding — corta chamadas ao provedor no pico. TTL 1h.
    const cacheKey = hashKey("emb:", queryVetor);
    embedding = await kvGetJson<number[]>(cacheKey);
    if (!embedding) {
      try {
        const { embedding: e } = await embed({
          model: await embeddingModel(),
          value: queryVetor,
          // Dimensão vai na CHAMADA neste SDK, não no modelo. Sem isto, um
          // modelo de 3072 devolveria vetor que a coluna vector(1536) recusa.
          providerOptions: await embeddingCallOptions(),
          // Curto de propósito: está no caminho de TODA busca do RAG. Provedor
          // lento aqui degrada para busca léxica em vez de travar a resposta.
          abortSignal: aiTimeout("embedding_query"),
        });
        embedding = e;
        await kvSetJson(cacheKey, e, 3600);
      } catch (e) {
        // Antes era um catch mudo: a busca virava só-léxica sem nenhum sinal.
        console.error(
          "[rag] embedding da pergunta falhou, caindo para busca léxica:",
          e instanceof Error ? e.message : e,
        );
        embedding = null;
      }
    }
  }

  const { data } = await supabase.rpc("hybrid_search_scoped", {
    p_query: pQuery,
    p_embedding: embedding ? JSON.stringify(embedding) : undefined,
    // `undefined` (e não array vazio) quando não há escopo daquele tipo: a
    // função trata null como "sem filtro deste lado", e um array vazio faria
    // `= any('{}')` never matching, o que é o mesmo — mas explícito é melhor.
    p_node_ids: nodeIds.length ? nodeIds : undefined,
    p_document_ids: documentIds.length ? documentIds : undefined,
    p_limit: limit,
    // Boost: chunks com termos/sinônimos da ontologia sobem na fusão (4º sinal).
    p_boost: boost ?? undefined,
    // A5: teto de GRUPOS (top-N manuais/documentos). undefined → default 2 (função);
    // pergunta composta pede 3-4 para cruzar mais manuais.
    p_group_limit: grupos ?? undefined,
  });

  let resultados = data ?? [];
  let forcadoNodeId: string | null = null;

  // VÍNCULO termo→artigo/diretório: garante que o "responsável" pelo termo entre
  // no contexto — o filtro de grupo do RPC pode tê-lo deixado de fora. Só busca
  // o que faltar, respeitando o escopo, e insere no topo (corta o último).
  if (responsaveis.length) {
    const artigos = new Set<string>();
    for (const nid of responsaveis) {
      const { data: sub } = await supabase.rpc("subtree_ids", { p_node_id: nid });
      for (const r of sub ?? []) if (r.type === "article") artigos.add(r.id);
    }
    const escopoSet = nodeIds.length ? new Set(nodeIds) : null;
    const jaTem = new Set(resultados.map((r) => r.node_id).filter((x): x is string => !!x));
    const faltando = [...artigos].filter((id) => (!escopoSet || escopoSet.has(id)) && !jaTem.has(id));
    if (faltando.length) {
      const { data: forcado } = await supabase.rpc("hybrid_search_scoped", {
        p_query: pQuery,
        p_embedding: embedding ? JSON.stringify(embedding) : undefined,
        p_node_ids: faltando,
        p_limit: 1,
        p_boost: boost ?? undefined,
      });
      if (forcado && forcado.length > 0) {
        forcadoNodeId = forcado[0]!.node_id ?? null;
        resultados = [forcado[0]!, ...resultados].slice(0, limit);
      }
    }
  }

  // ENUMERAÇÃO ("todos os X de Y"): o hybrid_search_scoped devolve no MÁXIMO 1
  // chunk por arquivo de conhecimento (distinct on document_id) — insuficiente
  // para listar TODOS os itens de uma lista (ex.: todos os programas de um
  // módulo, espalhados em vários chunks). Quando o usuário pede a lista inteira,
  // trazemos TODOS os chunks dos arquivos que casam a consulta e mesclamos (sem
  // duplicar), para o modelo montar a lista completa em vez de 2-3 exemplos.
  //
  // MAS só quando a documentação é a fonte PRINCIPAL do turno (limit > 3). Nos
  // modos em que a doc foi deliberadamente reduzida — roteado a uma tool (limit 2)
  // ou modo relatório (limit 3) — NÃO despejamos 40 chunks: um "quais" numa
  // pergunta pessoal (ex.: "quais são os meus benefícios?") casa RX_ENUMERA e
  // enchia o prompt com ~22k tokens de doc (lento e fora de propósito).
  if (documentIds.length && limit > 3 && pedeEnumeracao(query)) {
    // Consulta LIMPA (sem "quais/todos/liste…") para o AND do tsquery casar o
    // CONTEÚDO, não as palavras da pergunta.
    const { data: lista } = await supabase.rpc("knowledge_list_chunks", {
      p_query: limparConsultaLista(query),
      p_document_ids: documentIds,
      p_limit: 40,
    });
    if (lista?.length) {
      // Dedup por CONTEÚDO — inclusive entre as próprias linhas (há cópias do
      // mesmo CSV em espaços diferentes com chunks idênticos).
      const jaTem = new Set(resultados.map((r) => r.content));
      const extras: typeof resultados = [];
      for (const r of lista) {
        if (jaTem.has(r.content)) continue;
        jaTem.add(r.content);
        extras.push({
          node_id: null,
          document_id: r.document_id,
          title: r.title,
          heading_path: r.heading_path,
          snippet: "",
          content: r.content,
          score: r.score ?? 0,
        });
      }
      resultados = [...resultados, ...extras];
    }
  }

  // Miniatura por nó citado: capa do artigo ou 1ª imagem do conteúdo.
  // Chunk de arquivo não tem nó — fica de fora daqui e cita sem miniatura.
  const hitNodeIds = resultados.map((r) => r.node_id).filter((x): x is string => !!x);
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

  return resultados.map((r, i) => {
    // Fonte de ARQUIVO: não existe página no portal, então a citação sai sem
    // link. A UI já trata `url: null` (cartão sem âncora).
    if (!r.node_id) {
      return {
        n: i + 1,
        node_id: null,
        document_id: r.document_id,
        title: r.title ?? "Documento",
        // A8: âncora de ORIGEM = nome do arquivo (como o node usa o título do manual) —
        // dá à regra anti-mistura algo para distinguir 2 PDFs/arquivos diferentes.
        origin: r.title ?? "Documento",
        heading_path: r.heading_path,
        content: r.content,
        snippet: r.snippet ?? null,
        url: null,
        image: null,
        space_id: null,
        space_name: null,
        dir_node_id: null,
        dir_title: null,
        score: r.score ?? 0,
        forced: false,
      } as RetrievedSource;
    }
    const base = basePathById.get(r.node_id) ?? "";
    const anchor = r.heading_path
      ? "#" + slugify(r.heading_path.split(" > ").pop() ?? "")
      : "";
    const th = themeByNode.get(r.node_id);
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
      space_id: th?.spaceId ?? null,
      space_name: th?.spaceName ?? null,
      dir_node_id: th?.dirNodeId ?? null,
      dir_title: th?.dirTitle ?? null,
      score: r.score ?? 0,
      forced: r.node_id === forcadoNodeId,
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
  scope?: ClarifyScope | null,
): Promise<RetrievedSource[]> {
  const supabase = await createClient();
  const tree = await getEffectiveTreeAdmin(spaceId);
  return retrieveWith(supabase as DbClient, [{ spaceId, tree }], query, limit, scope);
}

/**
 * Busca autenticada em VÁRIAS documentações de uma vez (fusão RRF única no
 * Postgres). Usada pela IA de criação do Estúdio/editor, que enxerga TODAS as
 * docs para se apoiar. A RLS da sessão já limita ao que o autor pode ler.
 */
export async function retrieveContextMulti(
  spaceIds: string[],
  query: string,
  limit = 8,
): Promise<RetrievedSource[]> {
  const ids = [...new Set(spaceIds.filter(Boolean))];
  if (!ids.length) return [];
  const supabase = await createClient();
  const escopos = await Promise.all(
    ids.map(async (spaceId) => ({ spaceId, tree: await getEffectiveTreeAdmin(spaceId) })),
  );
  return retrieveWith(supabase as DbClient, escopos, query, limit);
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
  scope?: ClarifyScope | null,
  lang?: string | null,
  opts?: { lexicalOnly?: boolean; grupos?: number },
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
  return retrieveWith(supabase, escopos, query, limit, scope, lang, opts?.lexicalOnly, opts?.grupos);
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
