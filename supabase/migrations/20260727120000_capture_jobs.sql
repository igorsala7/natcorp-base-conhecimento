-- =====================================================================
-- Captura de telas (prints) de uma URL para enriquecer artigos.
-- Um navegador headless (Playwright) roda no WORKER; este job guarda o
-- estado/progresso (mesmo padrão de import_jobs/embedding_jobs). O destino
-- diz onde os prints aterrissam: numa prévia do Importador ou numa sessão do
-- Estúdio. As credenciais de login (quando houver) NÃO ficam aqui — vão numa
-- tabela isolada, cifradas, e são apagadas assim que o worker as usa.
-- =====================================================================
create table public.capture_jobs (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  url text not null,
  mode text not null default 'static' check (mode in ('static', 'interactive')),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'capturing', 'writing', 'preview', 'done', 'error')),
  progress int not null default 0,                 -- 0-100
  log jsonb not null default '[]'::jsonb,
  error text,
  -- {kind:'import', importJobId} | {kind:'studio', sessionId, targetTmpId}
  destino jsonb not null default '{}'::jsonb,
  needs_login boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index capture_jobs_space_idx on public.capture_jobs (space_id);

alter table public.capture_jobs enable row level security;
-- Autoria por qualquer caminho: importar (content.import) ou criar (content.create).
create policy capture_jobs_rw on public.capture_jobs for all to authenticated
  using (
    public.has_permission(auth.uid(), 'content.import', space_id)
    or public.has_permission(auth.uid(), 'content.create', space_id)
  )
  with check (
    public.has_permission(auth.uid(), 'content.import', space_id)
    or public.has_permission(auth.uid(), 'content.create', space_id)
  );
revoke all on public.capture_jobs from anon;

create trigger trg_capture_jobs_updated_at
  before update on public.capture_jobs
  for each row execute function public.touch_updated_at();

-- Realtime: alimenta a barra de progresso na tela.
alter table public.capture_jobs replica identity full;
alter publication supabase_realtime add table public.capture_jobs;

-- =====================================================================
-- Credenciais EFÊMERAS de login para a captura (páginas atrás de senha).
-- Tabela ISOLADA sem policy e sem grant a anon/authenticated (mesmo modelo de
-- ai_provider_keys): ninguém a alcança por SQL comum. A action grava cifrado
-- (AES-256-GCM, encryptSecret) via service-role; o worker lê via service-role,
-- decifra e APAGA a linha imediatamente após usar (delete-after-use). Nunca
-- entra no payload da fila nem em log.
-- =====================================================================
create table public.capture_secrets (
  job_id uuid primary key references public.capture_jobs (id) on delete cascade,
  usuario_enc text not null,
  senha_enc text not null,
  created_at timestamptz not null default now()
);
alter table public.capture_secrets enable row level security;
revoke all on public.capture_secrets from anon, authenticated;
