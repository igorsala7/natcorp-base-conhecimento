-- Fase 6 — Chatbot RAG. conversations/messages + busca escopada por nós.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  session_id text,
  user_ref uuid references auth.users (id),
  created_at timestamptz not null default now()
);
create index conversations_space_idx on public.conversations (space_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  citations jsonb not null default '[]'::jsonb,
  feedback int,                      -- +1 / -1
  latency_ms int,
  tokens int,
  created_at timestamptz not null default now()
);
create index messages_conv_idx on public.messages (conversation_id, created_at);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Autenticado com content.view no espaço gerencia suas conversas.
create policy conversations_rw on public.conversations
  for all to authenticated using (
    public.has_permission(auth.uid(), 'content.view', space_id)
  )
  with check (public.has_permission(auth.uid(), 'content.view', space_id));

create policy messages_rw on public.messages
  for all to authenticated using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and public.has_permission(auth.uid(), 'content.view', c.space_id)
    )
  )
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and public.has_permission(auth.uid(), 'content.view', c.space_id)
    )
  );

-- =====================================================================
-- RPC: busca híbrida escopada por lista de nós (respeita overlays/isolamento)
-- Funde full-text + trigram + vetorial (quando há embedding) por RRF.
-- =====================================================================
create or replace function public.hybrid_search_scoped(
  p_query text,
  p_embedding vector(1536) default null,
  p_node_ids uuid[] default null,
  p_limit int default 8
) returns table (
  node_id uuid,
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
    select c.* from public.chunks c
    where (p_node_ids is null or c.node_id = any (p_node_ids))
  ),
  ft as (
    select b.id, b.node_id,
           row_number() over (order by ts_rank(b.tsv, q.tsq) desc) as rnk
    from base b, q where b.tsv @@ q.tsq limit 40
  ),
  trg as (
    select b.id, b.node_id,
           row_number() over (
             order by greatest(
               similarity(public.f_unaccent(b.content), q.uq),
               similarity(public.f_unaccent(n.title), q.uq)
             ) desc
           ) as rnk
    from base b join public.nodes n on n.id = b.node_id, q
    where public.f_unaccent(b.content) % q.uq or public.f_unaccent(n.title) % q.uq
    limit 40
  ),
  vec as (
    select b.id, b.node_id,
           row_number() over (order by b.embedding <=> p_embedding) as rnk
    from base b
    where p_embedding is not null and b.embedding is not null
    limit 40
  ),
  fused as (
    select node_id, id, sum(1.0 / (60 + rnk)) as score
    from (
      select node_id, id, rnk from ft
      union all select node_id, id, rnk from trg
      union all select node_id, id, rnk from vec
    ) u
    group by node_id, id
  ),
  best as (
    select distinct on (node_id) node_id, id as chunk_id, score
    from fused order by node_id, score desc
  )
  select
    b.node_id, n.title, c.heading_path,
    ts_headline('portuguese', c.content,
      websearch_to_tsquery('portuguese', public.f_unaccent(p_query)),
      'MaxWords=40, MinWords=15, ShortWord=2') as snippet,
    c.content, b.score
  from best b
  join public.chunks c on c.id = b.chunk_id
  join public.nodes n on n.id = b.node_id
  where n.deleted_at is null
  order by b.score desc
  limit p_limit;
$$;
