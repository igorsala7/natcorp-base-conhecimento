-- Fase 3 — Busca híbrida (léxica agora; vetorial na Fase 6).
-- chunks por artigo/heading, tsvector 'portuguese', trigram para typos,
-- HNSW pronto para embeddings, e uma RPC única que funde tudo por RRF.

-- unaccent imutável (necessário para usar em coluna gerada e índice).
create or replace function public.f_unaccent(text)
  returns text
  language sql
  immutable
  parallel safe
  strict
  set search_path = public, extensions
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, $1)
$$;

-- =====================================================================
-- CHUNKS
-- =====================================================================
create table public.chunks (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles (id) on delete cascade,
  node_id uuid not null references public.nodes (id) on delete cascade,
  space_id uuid not null references public.spaces (id) on delete cascade,
  heading_path text,                 -- "Financeiro > Faturamento > Emitir NF"
  content text not null,
  token_count int,
  embedding vector(1536),            -- preenchido na Fase 6
  tsv tsvector generated always as (
    to_tsvector('portuguese', public.f_unaccent(coalesce(content, '')))
  ) stored
);

create index chunks_tsv_gin on public.chunks using gin (tsv);
create index chunks_content_trgm on public.chunks
  using gin (public.f_unaccent(content) gin_trgm_ops);
create index chunks_embedding_hnsw on public.chunks
  using hnsw (embedding vector_cosine_ops);
create index chunks_space_idx on public.chunks (space_id);
create index chunks_node_idx on public.chunks (node_id);

-- Trigram no título do nó (busca por prefixo/typo em títulos).
create index nodes_title_trgm on public.nodes
  using gin (public.f_unaccent(title) gin_trgm_ops);

alter table public.chunks enable row level security;
create policy chunks_auth_read on public.chunks
  for select to authenticated using (
    public.has_permission(auth.uid(), 'content.view', space_id)
  );
create policy chunks_public_read on public.chunks
  for select to anon using (
    exists (
      select 1 from public.nodes n
      join public.spaces s on s.id = n.space_id
      where n.id = chunks.node_id
        and n.status = 'published'
        and n.deleted_at is null
        and s.visibility = 'public'
    )
  );
-- Escrita dos chunks: só via funções/service (o app regenera ao salvar).
create policy chunks_write on public.chunks
  for all to authenticated using (
    public.has_permission(auth.uid(), 'content.edit', space_id)
  )
  with check (public.has_permission(auth.uid(), 'content.edit', space_id));

-- =====================================================================
-- SEARCH LOGS (buscas sem resultado = lacunas da documentação)
-- =====================================================================
create table public.search_logs (
  id uuid primary key default gen_random_uuid(),
  space_id uuid references public.spaces (id) on delete cascade,
  query text not null,
  results_count int not null default 0,
  user_ref uuid,
  created_at timestamptz not null default now()
);
alter table public.search_logs enable row level security;
create policy search_log_insert on public.search_logs
  for insert to anon, authenticated with check (true);
create policy search_log_read on public.search_logs
  for select to authenticated using (
    public.has_permission(auth.uid(), 'content.view', space_id)
  );

-- =====================================================================
-- RPC: busca híbrida (full-text + trigram) fundida por RRF
-- =====================================================================
-- SECURITY INVOKER (default): a RLS de chunks decide o que cada um vê.
create or replace function public.hybrid_search(
  p_query text,
  p_space_id uuid default null,
  p_limit int default 20
) returns table (
  node_id uuid,
  title text,
  heading_path text,
  snippet text,
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
  -- Ranking full-text
  ft as (
    select c.id, c.node_id,
           row_number() over (order by ts_rank(c.tsv, q.tsq) desc) as rnk
    from public.chunks c, q
    where (p_space_id is null or c.space_id = p_space_id)
      and c.tsv @@ q.tsq
    limit 50
  ),
  -- Ranking trigram (tolera erro de digitação), no conteúdo e no título
  trg as (
    select c.id, c.node_id,
           row_number() over (
             order by greatest(
               similarity(public.f_unaccent(c.content), q.uq),
               similarity(public.f_unaccent(n.title), q.uq)
             ) desc
           ) as rnk
    from public.chunks c
    join public.nodes n on n.id = c.node_id, q
    where (p_space_id is null or c.space_id = p_space_id)
      and (
        public.f_unaccent(c.content) % q.uq
        or public.f_unaccent(n.title) % q.uq
      )
    limit 50
  ),
  -- Reciprocal Rank Fusion (k = 60)
  fused as (
    select node_id, id, sum(1.0 / (60 + rnk)) as score
    from (
      select node_id, id, rnk from ft
      union all
      select node_id, id, rnk from trg
    ) u
    group by node_id, id
  ),
  -- Melhor chunk por nó
  best as (
    select distinct on (f.node_id)
      f.node_id, f.id as chunk_id, f.score
    from fused f
    order by f.node_id, f.score desc
  )
  select
    b.node_id,
    n.title,
    c.heading_path,
    ts_headline(
      'portuguese', c.content,
      websearch_to_tsquery('portuguese', public.f_unaccent(p_query)),
      'MaxWords=30, MinWords=10, ShortWord=2'
    ) as snippet,
    b.score
  from best b
  join public.chunks c on c.id = b.chunk_id
  join public.nodes n on n.id = b.node_id
  where n.deleted_at is null
  order by b.score desc
  limit p_limit;
$$;
