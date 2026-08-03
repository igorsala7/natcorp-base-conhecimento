-- Job de TRADUÇÃO da ontologia (bulk por espaço+idioma e auto-migração de novos termos).
-- Espelha ontology_jobs: progresso via Realtime; gravação pelo worker (service-role).
create table public.ontology_translation_jobs (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  lang text not null,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'done', 'error')),
  total int not null default 0,        -- termos a traduzir (faltantes)
  done int not null default 0,
  progress int not null default 0,     -- 0-100
  error text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index ontology_translation_jobs_space_idx on public.ontology_translation_jobs (space_id);

-- RLS: leitura para quem configura a IA (progresso no admin); escrita só service-role.
alter table public.ontology_translation_jobs enable row level security;
create policy ontology_translation_jobs_read on public.ontology_translation_jobs
  for select to authenticated
  using (public.has_permission(auth.uid(), 'ai.configure', space_id));
revoke all on public.ontology_translation_jobs from anon;
