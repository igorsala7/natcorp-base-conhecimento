-- =====================================================================
-- Processamento em LOTE, em segundo plano, da seleção múltipla da árvore:
-- publicar → embedding → ontologia, NESSA prioridade, um item de cada vez
-- (não simultâneo). Sem precisar abrir a tela de cada processo.
-- =====================================================================
create table public.bulk_jobs (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  node_ids uuid[] not null,                          -- seleção (artigos e/ou pastas)
  do_publish boolean not null default false,
  do_embedding boolean not null default false,
  do_ontology boolean not null default false,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'done', 'error')),
  phase text,                                        -- publicar | embedding | ontologia
  total int not null default 0,
  done int not null default 0,
  progress int not null default 0,                   -- 0-100
  error text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index bulk_jobs_space_idx on public.bulk_jobs (space_id);

alter table public.bulk_jobs enable row level security;
-- Gate no maior privilégio do lote (publicar); a Server Action confere as
-- permissões de cada processo escolhido.
create policy bulk_jobs_read on public.bulk_jobs
  for select to authenticated
  using (public.has_permission(auth.uid(), 'content.publish', space_id));
create policy bulk_jobs_write on public.bulk_jobs
  for all to authenticated
  using (public.has_permission(auth.uid(), 'content.publish', space_id))
  with check (public.has_permission(auth.uid(), 'content.publish', space_id));
revoke all on public.bulk_jobs from anon;

-- Realtime: alimenta a barra de progresso na árvore.
alter table public.bulk_jobs replica identity full;
alter publication supabase_realtime add table public.bulk_jobs;
