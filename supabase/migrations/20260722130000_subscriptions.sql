-- Assinaturas de novidades por documentação (padrão HubSpot: instant/daily/
-- weekly com double opt-in) + controle de última execução dos digests.
--
-- E-mail de leitor é dado pessoal: NENHUMA policy para anon; o portal escreve
-- via rota de API (service-role) com rate limit, e o admin enxerga apenas com
-- space.manage. O token único serve à confirmação E ao descadastro.

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  email text not null,
  frequency text not null default 'weekly'
    check (frequency in ('instant', 'daily', 'weekly')),
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (space_id, email)
);
create index subscriptions_space_idx on public.subscriptions (space_id);

create table public.subscription_runs (
  space_id uuid not null references public.spaces (id) on delete cascade,
  frequency text not null,
  last_run_at timestamptz not null default now(),
  primary key (space_id, frequency)
);

alter table public.subscriptions enable row level security;
alter table public.subscription_runs enable row level security;

create policy subscriptions_admin_read on public.subscriptions
  for select to authenticated
  using (public.has_permission(auth.uid(), 'space.manage', space_id));
