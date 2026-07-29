-- =====================================================================
-- Log de EXECUÇÃO das ferramentas (estilo n8n): cada chamada de tool grava o
-- que ENTROU (args do modelo), a REQUISIÇÃO montada (método + URL sanitizada,
-- sem segredos), o que SAIU (status + amostra truncada da resposta), o tempo e
-- o erro. É a fundação do "log por nó" do mapa visual (fase seguinte).
--
-- Privacidade: NUNCA grava segredos (a URL/corpo são redigidos no servidor). A
-- saída é uma AMOSTRA truncada. Leitura só para quem gerencia integrações; a
-- escrita é do runtime (service-role, que ignora RLS).
-- =====================================================================
create table if not exists public.ai_tool_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  base_code text not null,
  conversation_id uuid references public.conversations(id) on delete set null,
  tool_key text not null,
  agent_key text,
  step_index integer not null default 0,
  input jsonb,
  request jsonb,
  status integer,
  ok boolean not null default false,
  output jsonb,
  files integer not null default 0,
  cached boolean not null default false,
  duration_ms integer,
  error text
);

create index if not exists ai_tool_runs_created_idx on public.ai_tool_runs (created_at desc);
create index if not exists ai_tool_runs_base_idx on public.ai_tool_runs (base_code, created_at desc);
create index if not exists ai_tool_runs_tool_idx on public.ai_tool_runs (tool_key, created_at desc);
create index if not exists ai_tool_runs_conv_idx on public.ai_tool_runs (conversation_id);

alter table public.ai_tool_runs enable row level security;
revoke all on public.ai_tool_runs from anon;
-- Só LEITURA para quem gerencia integrações; sem policy de escrita → o único
-- caminho de gravação é o service-role (o runtime das tools), que ignora RLS.
create policy ai_tool_runs_read on public.ai_tool_runs
  for select to authenticated
  using (public.has_permission(auth.uid(), 'integrations.manage', null));
