import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Copia os DADOS DE BUSCA já prontos (embeddings + ontologia) de uma
 * documentação para outra, para NÃO gastar tokens regerando o que já existe.
 * Usa o admin client (dado de sistema, autorização já feita por quem chamou a
 * cópia de conteúdo). Melhor-esforço: uma falha aqui não desfaz a cópia dos
 * artigos — no pior caso a doc nova só não ganha os vetores/termos prontos.
 */

export type ArtPair = { srcNodeId: string; destNodeId: string; destArticleId: string };

/**
 * Copia os `chunks` dos artigos, REMAPEANDO `node_id`/`article_id` para os nós
 * recém-criados no destino e mantendo o VETOR `embedding` (é isso que economiza
 * tokens). `tsv` é coluna gerada — recalcula sozinha. `id` fica em branco (novo).
 */
export async function copyChunksForArticles(pairs: ArtPair[], destSpaceId: string): Promise<number> {
  if (!pairs.length) return 0;
  const admin = createAdminClient();
  const bySrc = new Map(pairs.map((p) => [p.srcNodeId, p]));
  const srcIds = pairs.map((p) => p.srcNodeId);
  let copiados = 0;
  for (let i = 0; i < srcIds.length; i += 100) {
    const slice = srcIds.slice(i, i + 100);
    const { data: chunks } = await admin
      .from("chunks")
      .select(
        "node_id, heading_path, content, token_count, embedding, embedding_provider, embedding_model, embedded_at, embedded_by",
      )
      .in("node_id", slice);
    const rows = [];
    for (const c of chunks ?? []) {
      const p = c.node_id ? bySrc.get(c.node_id) : null;
      if (!p) continue;
      rows.push({
        node_id: p.destNodeId,
        article_id: p.destArticleId,
        space_id: destSpaceId,
        heading_path: c.heading_path,
        content: c.content,
        token_count: c.token_count,
        embedding: c.embedding,
        embedding_provider: c.embedding_provider,
        embedding_model: c.embedding_model,
        embedded_at: c.embedded_at,
        embedded_by: c.embedded_by,
      });
    }
    if (rows.length) {
      const { error } = await admin.from("chunks").insert(rows);
      if (error) throw new Error(`chunks: ${error.message}`);
      copiados += rows.length;
    }
  }
  return copiados;
}

/**
 * Copia a ontologia (termos + sinônimos) da documentação de origem para a de
 * destino, com o MESMO merge da varredura: não duplica termo/sinônimo que já
 * exista no destino (como termo canônico OU alias) e não conflaciona conceitos.
 */
export async function copyOntologyBetweenSpaces(
  sourceSpaceId: string,
  destSpaceId: string,
): Promise<number> {
  const admin = createAdminClient();
  const { data: srcTerms } = await admin
    .from("ontology_terms")
    .select("id, term, term_norm, kind, description, source")
    .eq("space_id", sourceSpaceId);
  if (!srcTerms?.length) return 0;

  // `.in()` em fatias: centenas de UUIDs numa URL só estouram o limite do PostgREST.
  const aliasBySrcTerm = new Map<string, { alias: string; alias_norm: string; source: string }[]>();
  const srcIds = srcTerms.map((t) => t.id);
  for (let i = 0; i < srcIds.length; i += 200) {
    const { data: srcAliases } = await admin
      .from("ontology_aliases")
      .select("term_id, alias, alias_norm, source")
      .in("term_id", srcIds.slice(i, i + 200));
    for (const a of srcAliases ?? []) {
      const lista = aliasBySrcTerm.get(a.term_id) ?? [];
      lista.push({ alias: a.alias, alias_norm: a.alias_norm, source: a.source });
      aliasBySrcTerm.set(a.term_id, lista);
    }
  }

  // Índice do DESTINO: norm → termId, cobrindo termos canônicos E aliases.
  const normToTermId = new Map<string, string>();
  const { data: destTerms } = await admin
    .from("ontology_terms")
    .select("id, term_norm")
    .eq("space_id", destSpaceId);
  for (const t of destTerms ?? []) normToTermId.set(t.term_norm, t.id);
  const destIds = (destTerms ?? []).map((t) => t.id);
  for (let i = 0; i < destIds.length; i += 200) {
    const { data: destAliases } = await admin
      .from("ontology_aliases")
      .select("term_id, alias_norm")
      .in("term_id", destIds.slice(i, i + 200));
    for (const a of destAliases ?? []) if (!normToTermId.has(a.alias_norm)) normToTermId.set(a.alias_norm, a.term_id);
  }

  let novos = 0;
  for (const t of srcTerms) {
    let termId = normToTermId.get(t.term_norm);
    if (!termId) {
      const { data: novo } = await admin
        .from("ontology_terms")
        .insert({
          space_id: destSpaceId,
          term: t.term,
          term_norm: t.term_norm,
          kind: t.kind,
          description: t.description,
          source: t.source,
        })
        .select("id")
        .single();
      if (!novo) continue;
      termId = novo.id;
      normToTermId.set(t.term_norm, termId);
      novos += 1;
    }
    for (const a of aliasBySrcTerm.get(t.id) ?? []) {
      if (!a.alias_norm || a.alias_norm === t.term_norm) continue;
      if (normToTermId.has(a.alias_norm)) continue;
      await admin
        .from("ontology_aliases")
        .upsert({ term_id: termId, alias: a.alias, alias_norm: a.alias_norm, source: a.source }, { onConflict: "term_id,alias_norm", ignoreDuplicates: true });
      normToTermId.set(a.alias_norm, termId);
      novos += 1;
    }
  }
  return novos;
}

/** Copia embeddings (chunks) + ontologia de uma vez. */
export async function copySearchData(opts: {
  pairs: ArtPair[];
  sourceSpaceId: string;
  destSpaceId: string;
}): Promise<{ chunks: number; ontology: number }> {
  const chunks = await copyChunksForArticles(opts.pairs, opts.destSpaceId);
  const ontology = await copyOntologyBetweenSpaces(opts.sourceSpaceId, opts.destSpaceId);
  return { chunks, ontology };
}
