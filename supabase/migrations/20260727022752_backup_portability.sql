-- Portabilidade do backup: download/upload e envio/restauração via GitHub.

-- (1) Novos tipos de registro: 'upload' (backup trazido de fora) e 'github'
-- (envio ao GitHub). O check foi criado sem nome explícito → remove pelo nome
-- padrão do Postgres e recria.
alter table public.backup_jobs drop constraint if exists backup_jobs_kind_check;
alter table public.backup_jobs
  add constraint backup_jobs_kind_check
  check (kind in ('manual', 'auto', 'restore', 'upload', 'github'));

-- (2) Configuração do GitHub (o token vai cifrado em backup_secrets).
alter table public.backup_settings
  add column if not exists github_repo text,       -- "org/repositorio"
  add column if not exists github_branch text not null default 'main',
  add column if not exists github_path text not null default 'backups';

-- (3) Segredo isolado (deny-all; só service-role lê/escreve) para o token.
create table if not exists public.backup_secrets (
  id boolean primary key default true check (id),
  github_token_enc text,
  updated_at timestamptz not null default now()
);
insert into public.backup_secrets (id) values (true) on conflict (id) do nothing;

alter table public.backup_secrets enable row level security;
revoke all on public.backup_secrets from anon, authenticated;
