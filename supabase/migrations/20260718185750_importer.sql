-- Fase 4 — Importador inteligente.
-- import_jobs (fila de ingestão com progresso), bucket de storage e Realtime.

create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  source_file text not null,          -- caminho no storage
  original_name text,
  mime text,
  size_bytes bigint,
  status text not null default 'queued'
    check (status in (
      'queued', 'extracting', 'inferring', 'preview',
      'importing', 'done', 'error'
    )),
  progress int not null default 0,     -- 0..100
  log jsonb not null default '[]'::jsonb,
  extracted jsonb,                     -- seções/imagens extraídas
  result_tree jsonb,                   -- árvore proposta (editável no preview)
  target_parent_id uuid references public.nodes (id) on delete set null,
  error text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index import_jobs_space_idx on public.import_jobs (space_id);
create index import_jobs_status_idx on public.import_jobs (status);

create trigger trg_import_jobs_updated_at
  before update on public.import_jobs
  for each row execute function public.touch_updated_at();

alter table public.import_jobs enable row level security;

-- Só quem tem content.import no espaço enxerga/gerencia os jobs.
create policy import_jobs_read on public.import_jobs
  for select to authenticated using (
    public.has_permission(auth.uid(), 'content.import', space_id)
  );
create policy import_jobs_write on public.import_jobs
  for all to authenticated using (
    public.has_permission(auth.uid(), 'content.import', space_id)
  )
  with check (public.has_permission(auth.uid(), 'content.import', space_id));

-- Realtime: acompanha progresso do job ao vivo.
alter table public.import_jobs replica identity full;
alter publication supabase_realtime add table public.import_jobs;

-- Bucket privado para os arquivos de importação (PDF/DOCX/…).
insert into storage.buckets (id, name, public)
values ('imports', 'imports', false)
on conflict (id) do nothing;

create policy "imports_authenticated_all"
  on storage.objects for all to authenticated
  using (bucket_id = 'imports')
  with check (bucket_id = 'imports');
