-- Coerência por MANUAL no retrieval do RAG.
--
-- Cenário: uma documentação com ~20 PDFs importados, cada um virando um
-- diretório RAIZ com subpastas e artigos. Numa pergunta ambígua ("como emitir
-- o relatório?"), o top-8 global trazia trechos de vários manuais e o modelo
-- podia tecer o passo 1 de um com o aviso de outro.
--
-- O que muda: depois da fusão RRF, os resultados são agrupados pela ORIGEM —
-- artigo → seu diretório de 1º nível (primeiro rótulo do ltree `nodes.path`);
-- arquivo da base → o próprio documento — e só os 2 grupos mais fortes
-- (maior soma de score) seguem para o corte final. O contexto chega ao modelo
-- já coerente, sem depender de obediência ao prompt.
--
-- Trade-off assumido: perguntas comparativas legítimas ("quais manuais falam
-- de X?") enxergam no máximo 2 manuais por resposta. É o preço de nunca
-- misturar procedimentos — e a busca Cmd+K (hybrid_search) segue sem grupo.
drop function if exists public.hybrid_search_scoped(text, vector, uuid[], int, uuid[]);

create or replace function public.hybrid_search_scoped(
  p_query text,
  p_embedding vector(1536) default null,
  p_node_ids uuid[] default null,
  p_limit int default 8,
  p_document_ids uuid[] default null
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
           websearch_to_tsquery('portuguese', public.f_unaccent(p_query)) as tsq
  ),
  base as (
    select c.*, coalesce(c.node_id, c.document_id) as origem
    from public.chunks c
    where
      -- Sem nenhum escopo informado, mantém o comportamento antigo (tudo).
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
  fused as (
    select origem, id, sum(1.0 / (60 + rnk)) as score
    from (
      select origem, id, rnk from ft
      union all select origem, id, rnk from trg
      union all select origem, id, rnk from vec
    ) u
    group by origem, id
  ),
  best as (
    select distinct on (origem) origem, id as chunk_id, score
    from fused order by origem, score desc
  ),
  -- O grupo de cada resultado: diretório raiz do artigo, ou o arquivo.
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
  -- Nó excluído sai; chunk de arquivo (sem nó) permanece.
  where c.node_id is null or n.deleted_at is null
  order by a.score desc
  limit p_limit;
$$;
