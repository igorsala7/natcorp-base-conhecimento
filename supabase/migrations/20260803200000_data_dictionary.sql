-- DICIONÁRIO DE DADOS + INGESTÃO DE APP/OBJETOS APEX/ORACLE.
-- Catálogo único que guarda, por documentação (space_id), tanto os componentes de uma
-- aplicação APEX (páginas, itens, regiões, colunas de relatório…) quanto os objetos de
-- banco (tabelas, views, colunas, procedures, triggers, packages), com a LABEL associada
-- e o mapeamento item/coluna→campo do banco. Alimenta a ontologia/RAG, a tradução (XLIFF)
-- e a geração de documentação. Fonte: dicionário APEX (ORDS), export f*.sql, ou DDL.

create table public.data_dictionary (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  -- Tipo do objeto catalogado.
  kind text not null check (kind in (
    'table', 'view', 'column', 'trigger', 'procedure', 'function', 'package',
    'apex_app', 'apex_page', 'apex_region', 'apex_item', 'apex_button',
    'apex_report_col', 'apex_breadcrumb', 'apex_list', 'apex_validation',
    'apex_process', 'apex_dynamic_action', 'apex_computation', 'other'
  )),
  name text not null,                 -- nome do objeto (ex.: P10_COD_EMPRESA, EMPRESAS, cod_empresa)
  parent_name text,                   -- pai (ex.: a tabela da coluna, a região do item, a página)
  label text,                         -- rótulo/heading (PT) associado
  description text,                   -- descrição (IA ou manual)
  db_table text,                      -- tabela do banco referenciada (mapeamento)
  db_column text,                     -- coluna do banco referenciada
  source text not null default 'apex_dict'
    check (source in ('apex_dict', 'apex_export', 'db_ddl', 'manual')),
  app_id text,                        -- id da aplicação APEX (contexto)
  page_id text,                       -- id da página (contexto)
  metadata jsonb not null default '{}'::jsonb,  -- metadados crus do componente/objeto
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Unicidade por (espaço, tipo, nome, pai) — pai nulo tratado como '' (índice com expressão,
-- pois UNIQUE de tabela não aceita função).
create unique index data_dictionary_unico
  on public.data_dictionary (space_id, kind, name, coalesce(parent_name, ''));
create index data_dictionary_space_idx on public.data_dictionary (space_id);
create index data_dictionary_kind_idx on public.data_dictionary (space_id, kind);
create index data_dictionary_dbcol_idx on public.data_dictionary (space_id, db_table, db_column);

alter table public.data_dictionary enable row level security;
create policy data_dictionary_read on public.data_dictionary
  for select to authenticated
  using (public.has_permission(auth.uid(), 'content.view', space_id));
create policy data_dictionary_write on public.data_dictionary
  for all to authenticated
  using (public.has_permission(auth.uid(), 'ai.configure', space_id))
  with check (public.has_permission(auth.uid(), 'ai.configure', space_id));
revoke all on public.data_dictionary from anon;

-- Job de INGESTÃO (extrair app/objetos → catálogo/ontologia/doc/tradução). Espelha os
-- demais jobs: progresso via Realtime; gravação pelo worker (service-role).
create table public.data_dictionary_jobs (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  kind text not null default 'apex_ingest'
    check (kind in ('apex_ingest', 'db_objects', 'apex_docs', 'apex_translate')),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'done', 'error')),
  total int not null default 0,
  done int not null default 0,
  progress int not null default 0,
  found int not null default 0,
  error text,
  input jsonb not null default '{}'::jsonb,     -- parâmetros (app_id, base_code, opções)
  result jsonb,                                  -- resumo (contagens, planilha, links)
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index data_dictionary_jobs_space_idx on public.data_dictionary_jobs (space_id);

alter table public.data_dictionary_jobs enable row level security;
create policy data_dictionary_jobs_read on public.data_dictionary_jobs
  for select to authenticated
  using (public.has_permission(auth.uid(), 'ai.configure', space_id));
revoke all on public.data_dictionary_jobs from anon;
