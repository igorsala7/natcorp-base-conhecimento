-- Relatórios salvos pelo usuário final do widget (resultado de uma pesquisa no
-- Interactive Report). Escopo por (espaço + identidade do usuário no rastreio) —
-- o widget NUNCA fala com o banco: a rota /api/v1/saved-reports (service-role)
-- valida a chave pública + o token de rastreio e grava/lê em nome do usuário.

create table if not exists widget_saved_reports (
  id            uuid primary key default gen_random_uuid(),
  space_id      uuid not null references spaces (id) on delete cascade,
  widget_key_id uuid references widget_keys (id) on delete set null,
  user_ref      text not null,                 -- "<p_base>:<p_usuario|matricula>" — escopo por usuário
  name          text not null,
  source_name   text,                          -- nome do relatório/região de origem
  columns       jsonb not null default '[]'::jsonb,  -- string[]
  rows          jsonb not null default '[]'::jsonb,  -- string[][]
  total         integer not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists widget_saved_reports_lookup
  on widget_saved_reports (space_id, user_ref, created_at desc);

alter table widget_saved_reports enable row level security; -- só service-role (a rota valida a chave)
