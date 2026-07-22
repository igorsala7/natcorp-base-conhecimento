-- Sessões do ESTÚDIO IA: conversa + proposta de conteúdo (árvore de pastas e
-- artigos com corpo em blocos) retomáveis. O resultado final vira nós reais
-- (rascunho) via materialização; a sessão então é marcada 'created'.
create table public.studio_sessions (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  title text not null default 'Nova conversa',
  status text not null default 'open' check (status in ('open', 'created')),
  messages jsonb not null default '[]'::jsonb,
  proposal jsonb not null default '[]'::jsonb,
  target jsonb not null default '{}'::jsonb,
  materiais jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index studio_sessions_space_idx on public.studio_sessions (space_id, updated_at desc);

alter table public.studio_sessions enable row level security;

-- Quem cria conteúdo no espaço usa o estúdio (colaborativo por espaço).
create policy studio_sessions_all on public.studio_sessions
  for all to authenticated
  using (public.has_permission(auth.uid(), 'content.create', space_id))
  with check (public.has_permission(auth.uid(), 'content.create', space_id));
