-- LOG do fluxo do chat: passo a passo de cada turno (classificação, RAG, ontologia,
-- roteador de fonte, coleta, ferramentas, chamadas de tool, modelo, resposta), para
-- rastrear onde a lógica falha. Filtrável por base/cliente, data e os p_* de rastreio
-- (iguais aos demais relatórios). Escrita por service-role (fora do RLS), como ai_usage.

create table if not exists ai_chat_traces (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  conversation_id uuid,
  space_id        uuid,
  base_code       text,
  p_usuario       text,
  p_portal        text,
  p_empresa       text,
  p_matricula     text,
  p_perfil        text,
  pergunta        text,
  fonte           text,
  desfecho        text,
  duracao_ms      integer,
  passos          jsonb not null default '[]'::jsonb
);

create index if not exists ai_chat_traces_created_idx on ai_chat_traces (created_at desc);
create index if not exists ai_chat_traces_base_idx on ai_chat_traces (base_code, created_at desc);

alter table ai_chat_traces enable row level security;
-- Só leitura, para quem configura IA/sistema. Escrita passa por service-role (sem policy).
drop policy if exists ai_chat_traces_read on ai_chat_traces;
create policy ai_chat_traces_read on ai_chat_traces
  for select using (has_permission(auth.uid(), 'ai.configure', null));
revoke all on ai_chat_traces from anon;

comment on table ai_chat_traces is
  'Rastreio passo a passo do fluxo do chat por turno (diagnóstico do roteamento/ferramentas). Retenção sugerida: limpar por job.';
