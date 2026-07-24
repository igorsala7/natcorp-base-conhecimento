-- =====================================================================
-- Job de geração de embeddings em segundo plano (com progresso).
-- A geração de UMA documentação inteira (dezenas/centenas de artigos) era
-- inline numa Server Action — lenta e sem feedback. Agora vira job no worker,
-- com progresso via Realtime (mesmo padrão de import_jobs).
-- =====================================================================
create table public.embedding_jobs (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  scope text not null check (scope in ('space', 'subtree', 'article')),
  target_id uuid,                                   -- nó (subtree/article); null p/ space
  status text not null default 'queued'
    check (status in ('queued', 'running', 'done', 'error')),
  total int not null default 0,
  done int not null default 0,
  progress int not null default 0,                  -- 0-100
  error text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index embedding_jobs_space_idx on public.embedding_jobs (space_id);

alter table public.embedding_jobs enable row level security;
create policy embedding_jobs_read on public.embedding_jobs
  for select to authenticated
  using (public.has_permission(auth.uid(), 'embeddings.reindex', space_id));
create policy embedding_jobs_write on public.embedding_jobs
  for all to authenticated
  using (public.has_permission(auth.uid(), 'embeddings.reindex', space_id))
  with check (public.has_permission(auth.uid(), 'embeddings.reindex', space_id));
revoke all on public.embedding_jobs from anon;

-- Realtime: alimenta a barra de progresso na tela.
alter table public.embedding_jobs replica identity full;
alter publication supabase_realtime add table public.embedding_jobs;

-- =====================================================================
-- Cache do CONTEXTO por documento (Fase 3 — "varredura por IA").
-- Antes de vetorizar, a IA lê o documento inteiro e gera um contexto curto
-- que é prefixado em todos os chunks (melhora a assertividade da busca). É
-- cacheado por hash do conteúdo para NÃO repetir a chamada a cada publicação.
-- =====================================================================
alter table public.articles
  add column embedding_context text,
  add column embedding_context_hash text;
alter table public.knowledge_documents
  add column embedding_context text,
  add column embedding_context_hash text;
