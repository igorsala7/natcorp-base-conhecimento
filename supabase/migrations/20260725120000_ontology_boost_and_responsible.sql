-- =====================================================================
-- Ontologia mais forte na busca:
--  (1) VÍNCULO termo → nó "responsável" (artigo ou diretório): quando o termo
--      é perguntado, o artigo responsável é forçado no contexto (feito no app).
--  (2) BOOST: chunks cujo texto contém um termo/sinônimo casado ganham um
--      quarto sinal na fusão RRF (sobem no rank).
-- =====================================================================

-- (1) Nó responsável pelo termo (artigo ou diretório). NULL = sem vínculo.
alter table public.ontology_terms
  add column if not exists node_id uuid references public.nodes (id) on delete set null;
comment on column public.ontology_terms.node_id is
  'Artigo/diretório RESPONSÁVEL pelo termo — forçado no RAG quando o termo é perguntado.';

-- (2) Recria o hybrid_search_scoped com um parâmetro de BOOST (tsquery só dos
-- termos/sinônimos da ontologia). Assinatura nova (6 args) → dropa a antiga.
drop function if exists public.hybrid_search_scoped(text, vector, uuid[], int, uuid[]);

create or replace function public.hybrid_search_scoped(
  p_query text,
  p_embedding vector(1536) default null,
  p_node_ids uuid[] default null,
  p_limit int default 8,
  p_document_ids uuid[] default null,
  p_boost text default null
) returns table (
  node_id uuid,
  document_id uuid,
  title text,
  heading_path text,
  snippet text,
  content text,
  score double precision
)
  language sql
  stable
  set search_path = public, extensions
as $$
  with q as (
    select public.f_unaccent(p_query) as uq,
           websearch_to_tsquery('portuguese', public.f_unaccent(p_query)) as tsq,
           case
             when p_boost is null or btrim(p_boost) = '' then null
             else websearch_to_tsquery('portuguese', public.f_unaccent(p_boost))
           end as bq
  ),
  base as (
    select c.*, coalesce(c.node_id, c.document_id) as origem
    from public.chunks c
    where
      (p_node_ids is null and p_document_ids is null)
      or (p_node_ids is not null and c.node_id = any (p_node_ids))
      or (p_document_ids is not null and c.document_id = any (p_document_ids))
  ),
  ft as (
    select b.id, b.origem,
           row_number() over (order by ts_rank(b.tsv, q.tsq) desc) as rnk
    from base b, q where b.tsv @@ q.tsq limit 40
  ),
  trg as (
    select b.id, b.origem,
           row_number() over (
             order by greatest(
               similarity(public.f_unaccent(b.content), q.uq),
               similarity(public.f_unaccent(coalesce(n.title, d.original_name, '')), q.uq)
             ) desc
           ) as rnk
    from base b
    left join public.nodes n on n.id = b.node_id
    left join public.knowledge_documents d on d.id = b.document_id, q
    where public.f_unaccent(b.content) % q.uq
       or public.f_unaccent(coalesce(n.title, d.original_name, '')) % q.uq
    limit 40
  ),
  vec as (
    select b.id, b.origem,
           row_number() over (order by b.embedding <=> p_embedding) as rnk
    from base b
    where p_embedding is not null and b.embedding is not null
    limit 40
  ),
  -- BOOST: chunks que casam os termos/sinônimos da ontologia entram como um 4º
  -- sinal na fusão — sobem no rank sem depender de casar as palavras da pergunta.
  boost as (
    select b.id, b.origem,
           row_number() over (order by ts_rank(b.tsv, q.bq) desc) as rnk
    from base b, q where q.bq is not null and b.tsv @@ q.bq limit 40
  ),
  fused as (
    select origem, id, sum(1.0 / (60 + rnk)) as score
    from (
      select origem, id, rnk from ft
      union all select origem, id, rnk from trg
      union all select origem, id, rnk from vec
      union all select origem, id, rnk from boost
    ) u
    group by origem, id
  ),
  best as (
    select distinct on (origem) origem, id as chunk_id, score
    from fused order by origem, score desc
  ),
  agrupado as (
    select b.chunk_id, b.score,
           case
             when c2.node_id is not null
               then 'raiz:' || coalesce(subpath(n2.path, 0, 1)::text, c2.node_id::text)
             else 'doc:' || c2.document_id::text
           end as grupo
    from best b
    join public.chunks c2 on c2.id = b.chunk_id
    left join public.nodes n2 on n2.id = c2.node_id
  ),
  melhores_grupos as (
    select grupo
    from agrupado
    group by grupo
    order by sum(score) desc, max(score) desc
    limit 2
  )
  select
    c.node_id,
    c.document_id,
    coalesce(n.title, d.original_name) as title,
    c.heading_path,
    ts_headline('portuguese', c.content,
      websearch_to_tsquery('portuguese', public.f_unaccent(p_query)),
      'MaxWords=40, MinWords=15, ShortWord=2') as snippet,
    c.content, a.score
  from agrupado a
  join melhores_grupos using (grupo)
  join public.chunks c on c.id = a.chunk_id
  left join public.nodes n on n.id = c.node_id
  left join public.knowledge_documents d on d.id = c.document_id
  where c.node_id is null or n.deleted_at is null
  order by a.score desc
  limit p_limit;
$$;
