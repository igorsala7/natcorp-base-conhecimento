-- Datasets coletados do widget, persistidos por id (Fase F1 da análise A/B).
-- Objetivo: parar de reenviar TODAS as linhas do relatório a cada turno. O widget
-- coleta UMA vez, salva aqui e passa a mandar só o `id`; o servidor rehidrata o
-- dataset por id (registrarTabelaTela) e as ferramentas de análise (consultar/
-- agregar/estatisticas/agrupar) funcionam igual — só muda a ORIGEM das linhas.
--
-- Isolamento POR USUÁRIO é obrigatório: escopo por (espaço + identidade do rastreio).
-- O widget NUNCA fala com o banco — a rota /api/v1/datasets (service-role) valida a
-- chave pública + o token de rastreio e grava/lê em nome do usuário. RLS ligada SEM
-- policy = só o service-role alcança; a rota SEMPRE filtra por space_id + user_ref.

create table if not exists widget_datasets (
  id            uuid primary key default gen_random_uuid(),
  space_id      uuid not null references spaces (id) on delete cascade,
  widget_key_id uuid references widget_keys (id) on delete set null,
  user_ref      text not null,                 -- "<p_base>:<p_usuario|matricula>" — escopo por usuário
  client_key    text not null,                 -- "<regionKey>:<fingerprint>" — reusa/invalida ao mudar filtro
  source_name   text,                          -- nome do relatório/região de origem
  columns       jsonb not null default '[]'::jsonb,  -- string[]
  rows          jsonb,                         -- string[][] (NULL quando o conjunto vive em storage_path)
  storage_path  text,                          -- caminho no bucket privado (gzip) p/ conjuntos grandes
  total         integer not null default 0,
  created_at    timestamptz not null default now()
);

-- Um dataset por (usuário, relatório+filtro): re-salvar o mesmo recorte reaproveita a
-- linha (idempotência via onConflict). A rota garante client_key não-vazio.
create unique index if not exists widget_datasets_client_key
  on widget_datasets (space_id, user_ref, client_key);

create index if not exists widget_datasets_lookup
  on widget_datasets (space_id, user_ref, created_at desc);

alter table widget_datasets enable row level security; -- só service-role (a rota valida a chave)
