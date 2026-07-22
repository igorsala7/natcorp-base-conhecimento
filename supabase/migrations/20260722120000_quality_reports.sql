-- Auditoria de qualidade/SEO (painel Otimizar + scan por documentação).
--
-- `link_checks`: cache global de verificação de links EXTERNOS (o worker checa
-- com HEAD/GET e guarda por URL — documentos repetem os mesmos links dezenas
-- de vezes). `quality_reports`: resultado da última varredura por artigo.

create table public.link_checks (
  url text primary key,
  ok boolean,
  status int,
  checked_at timestamptz not null default now()
);

create table public.quality_reports (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  node_id uuid not null references public.nodes (id) on delete cascade,
  issues jsonb not null default '[]'::jsonb,
  score int not null default 0,
  run_at timestamptz not null default now(),
  unique (node_id)
);
create index quality_reports_space_idx on public.quality_reports (space_id);

alter table public.link_checks enable row level security;
alter table public.quality_reports enable row level security;

-- Só leitura para a equipe; quem escreve é o worker (service-role, fora do RLS).
create policy link_checks_read on public.link_checks
  for select to authenticated using (true);
create policy quality_reports_read on public.quality_reports
  for select to authenticated using (
    public.has_permission(auth.uid(), 'content.view', space_id)
  );
