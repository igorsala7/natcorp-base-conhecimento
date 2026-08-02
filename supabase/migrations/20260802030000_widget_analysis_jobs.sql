-- Job de ANÁLISE SEMÂNTICA por linha (modo B) disparado pelo widget (Fase F3).
-- Lê o texto de uma coluna de um dataset coletado e classifica cada linha (map→reduce).
-- É CARO → opt-in; roda no worker (pg-boss), fora do request. O progresso é por POLLING
-- (o widget é anônimo, não abre Realtime) e o resultado também é postado no chat.
--
-- ISOLAMENTO POR USUÁRIO obrigatório: NÃO reusa analysis_jobs (que é escopo-de-espaço,
-- via chave sk_). Esta tabela carrega space_id + user_ref + session_id + o token de
-- rastreio (cifrado) — o worker re-deriva a identidade do token e SEMPRE filtra o
-- dataset por space_id + user_ref. RLS ligada SEM policy = só service-role (as rotas
-- validam a chave pública + o rastreio).

create table if not exists widget_analysis_jobs (
  id              uuid primary key default gen_random_uuid(),
  space_id        uuid not null references spaces (id) on delete cascade,
  widget_key_id   uuid references widget_keys (id) on delete set null,
  user_ref        text not null,                 -- "<p_base>:<p_usuario|matricula>" — escopo por usuário
  session_id      text,
  conversation_id uuid references conversations (id) on delete set null,
  dataset_id      uuid not null references widget_datasets (id) on delete cascade,
  kind            text not null default 'semantic_classify',
  status          text not null default 'queued' check (status in ('queued','running','done','error','canceled')),
  instrucao       text,                          -- o que julgar (critério)
  target_column   text not null,                 -- coluna de texto a classificar
  rotulos         jsonb not null default '[]'::jsonb,  -- string[] (classes)
  pre_filtro      jsonb not null default '[]'::jsonb,  -- Filtro[] (registro; já aplicado ao dataset_id)
  estimate        jsonb,                         -- { linhas, chamadas, tokensEntrada, segundos }
  processed       integer not null default 0,
  total           integer not null default 0,
  progress        integer not null default 0,    -- 0..100
  result          jsonb,                         -- { distribuicao, exemplos, narrativa, total }
  track           text,                          -- token de rastreio CIFRADO (worker re-deriva identidade)
  error           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists widget_analysis_jobs_lookup
  on widget_analysis_jobs (space_id, user_ref, created_at desc);

alter table widget_analysis_jobs enable row level security; -- só service-role (a rota valida a chave)

-- Resultado parcial por lote (map) — idempotência do reprocessamento. job_id já carrega
-- o escopo (user_ref) via FK; cascata ao apagar o job.
create table if not exists widget_analysis_chunks (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references widget_analysis_jobs (id) on delete cascade,
  seq        integer not null,
  result     jsonb,                              -- itens classificados deste lote
  created_at timestamptz not null default now(),
  unique (job_id, seq)
);

alter table widget_analysis_chunks enable row level security; -- só service-role
