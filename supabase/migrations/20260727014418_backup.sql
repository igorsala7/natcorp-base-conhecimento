-- ─────────────────────────────────────────────────────────────────────────────
-- Backup / Restore de banco + arquivos (Sistema → Backup)
-- ─────────────────────────────────────────────────────────────────────────────

-- (1) Permissão nova. Owner já tem "todas" por um insert sem filtro no seed
-- inicial, mas isso rodou no passado — uma permissão nova precisa ser concedida
-- explicitamente aqui (Owner e Admin técnico).
insert into public.permissions (key, description)
values ('system.backup', 'Fazer, restaurar e configurar backups do sistema')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r, public.permissions p
where r.key in ('owner', 'admin_tech') and p.key = 'system.backup'
on conflict do nothing;

-- (2) Bucket PRIVADO para os arquivos de backup.
insert into storage.buckets (id, name, public)
values ('backups', 'backups', false)
on conflict (id) do nothing;

drop policy if exists "backups_perm_all" on storage.objects;
create policy "backups_perm_all" on storage.objects for all to authenticated
  using (bucket_id = 'backups' and public.has_permission(auth.uid(), 'system.backup', null))
  with check (bucket_id = 'backups' and public.has_permission(auth.uid(), 'system.backup', null));

-- (3) Registro de cada backup/restauração (com progresso em tempo real).
create table if not exists public.backup_jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'manual' check (kind in ('manual', 'auto', 'restore')),
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'error')),
  progress int not null default 0,          -- 0-100
  phase text,                               -- "banco", "arquivos", "restaurando"…
  storage_path text,                        -- pasta do backup no bucket 'backups'
  include_storage boolean not null default true,
  bytes bigint,                             -- tamanho total do backup
  tables_count int,
  rows_count bigint,
  files_count int,
  source_backup_id uuid references public.backup_jobs(id) on delete set null, -- p/ restore
  error text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists backup_jobs_created_idx on public.backup_jobs (created_at desc);

alter table public.backup_jobs enable row level security;
drop policy if exists backup_jobs_rw on public.backup_jobs;
create policy backup_jobs_rw on public.backup_jobs for all to authenticated
  using (public.has_permission(auth.uid(), 'system.backup', null))
  with check (public.has_permission(auth.uid(), 'system.backup', null));

-- Realtime: alimenta a barra de progresso na tela de Sistema.
alter table public.backup_jobs replica identity full;
alter publication supabase_realtime add table public.backup_jobs;

-- (4) Configuração (singleton, padrão do projeto: id bool com check).
create table if not exists public.backup_settings (
  id boolean primary key default true check (id),
  auto_enabled boolean not null default false,
  frequency text not null default 'daily' check (frequency in ('daily', 'weekly')),
  hour int not null default 3 check (hour between 0 and 23),
  weekday int not null default 0 check (weekday between 0 and 6),  -- 0 = domingo
  include_storage boolean not null default true,
  retention_days int not null default 30 check (retention_days between 1 and 3650),
  last_run_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.backup_settings (id) values (true) on conflict (id) do nothing;

alter table public.backup_settings enable row level security;
drop policy if exists backup_settings_rw on public.backup_settings;
create policy backup_settings_rw on public.backup_settings for all to authenticated
  using (public.has_permission(auth.uid(), 'system.backup', null))
  with check (public.has_permission(auth.uid(), 'system.backup', null));
