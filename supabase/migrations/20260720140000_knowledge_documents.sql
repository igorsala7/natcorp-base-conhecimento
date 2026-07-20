-- =====================================================================
-- Base de conhecimento por arquivo: PDF/Word/Excel/HTML que viram embedding
-- SEM virar artigo. O chatbot enxerga; o portal público, não.
-- =====================================================================

create table public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  storage_path text not null,
  original_name text not null,
  mime text,
  size_bytes bigint,
  status text not null default 'queued'
    check (status in ('queued', 'extracting', 'ready', 'error')),
  error text,
  chunk_count int not null default 0,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
create index knowledge_documents_space_idx on public.knowledge_documents (space_id);

alter table public.knowledge_documents enable row level security;

-- Quem edita o conteúdo do espaço administra a base de arquivos dele.
-- NÃO há policy para `anon`: o público nunca lista nem lê estes documentos.
create policy knowledge_documents_read on public.knowledge_documents
  for select to authenticated using (
    public.has_permission(auth.uid(), 'content.view', space_id)
  );
create policy knowledge_documents_write on public.knowledge_documents
  for all to authenticated using (
    public.has_permission(auth.uid(), 'content.edit', space_id)
  )
  with check (public.has_permission(auth.uid(), 'content.edit', space_id));

revoke all on public.knowledge_documents from anon;

-- =====================================================================
-- `chunks` passa a ter DUAS origens possíveis: um nó da árvore (artigo) ou um
-- documento da base. O check garante exatamente uma — sem ele, um chunk órfão
-- (as duas nulas) ficaria invisível para sempre, e um com as duas apareceria
-- em dois escopos.
-- =====================================================================
alter table public.chunks alter column article_id drop not null;
alter table public.chunks alter column node_id drop not null;
alter table public.chunks
  add column document_id uuid references public.knowledge_documents (id) on delete cascade;
create index chunks_document_idx on public.chunks (document_id);

alter table public.chunks add constraint chunks_uma_origem check (
  (node_id is not null and document_id is null)
  or (node_id is null and document_id is not null)
);

-- =====================================================================
-- Busca híbrida com as duas origens.
--
-- Três mudanças além do novo parâmetro, todas obrigatórias:
--  1. `join nodes` vira LEFT JOIN — chunk de arquivo não tem nó;
--  2. a chave de deduplicação passa de `node_id` para
--     `coalesce(node_id, document_id)`. Com `distinct on (node_id)` e node_id
--     nulo, TODOS os trechos de arquivo colapsariam num resultado só;
--  3. o título sai do nó ou do nome do arquivo.
-- =====================================================================
drop function if exists public.hybrid_search_scoped(text, vector, uuid[], int);

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
  )
  select
    c.node_id,
    c.document_id,
    coalesce(n.title, d.original_name) as title,
    c.heading_path,
    ts_headline('portuguese', c.content,
      websearch_to_tsquery('portuguese', public.f_unaccent(p_query)),
      'MaxWords=40, MinWords=15, ShortWord=2') as snippet,
    c.content, b.score
  from best b
  join public.chunks c on c.id = b.chunk_id
  left join public.nodes n on n.id = c.node_id
  left join public.knowledge_documents d on d.id = c.document_id
  -- Nó excluído sai; chunk de arquivo (sem nó) permanece.
  where c.node_id is null or n.deleted_at is null
  order by b.score desc
  limit p_limit;
$$;
