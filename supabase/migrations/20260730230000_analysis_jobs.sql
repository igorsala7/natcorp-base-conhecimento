-- Análise de dados em LOTE via API (POST do backend Oracle / Interactive Reports).
-- Os dados chegam em CHUNKS (transporte), são montados 100% no servidor e só então
-- analisados pela IA. Tabelas internas: escrita/leitura só pelo service-role
-- (a rota valida a chave sk_ com escopo data.analyze antes de tocar aqui).

create table if not exists analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  space_id uuid references spaces(id) on delete cascade,
  batch_id text not null,                 -- agrupador dos chunks (o proc gera)
  status text not null default 'coletando' check (status in ('coletando','analisando','concluido','erro')),
  columns jsonb,                          -- cabeçalho (nomes das colunas)
  instrucao text,                         -- o que analisar
  destino text not null default 'api' check (destino in ('api','chat','ambos')),
  total_chunks int,                       -- se informado, fecha ao receber todos
  received_chunks int not null default 0,
  received_rows int not null default 0,
  result jsonb,                           -- { analise, resumo, meta }
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (space_id, batch_id)
);

create table if not exists analysis_chunks (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references analysis_jobs(id) on delete cascade,
  seq int not null,
  rows jsonb not null,                    -- array de linhas (arrays ou objetos)
  created_at timestamptz not null default now(),
  unique (job_id, seq)                    -- idempotente: reenvio do mesmo seq não duplica
);

create index if not exists analysis_chunks_job_seq on analysis_chunks (job_id, seq);
create index if not exists analysis_jobs_created on analysis_jobs (created_at);

alter table analysis_jobs enable row level security;
alter table analysis_chunks enable row level security;
-- Sem policies: nenhum acesso por anon/authed. Só o service-role (que ignora RLS)
-- escreve/lê, depois da rota validar a chave sk_ + escopo.
