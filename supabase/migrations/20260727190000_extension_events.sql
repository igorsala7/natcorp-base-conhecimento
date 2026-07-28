-- Fase 5.1 — eventos de uma sessão de captura (por ora, PRINTS de tela; nas
-- próximas fases também navegação/clique). Genérico para não migrar de novo.
create table public.extension_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.extension_sessions (id) on delete cascade,
  kind text not null,            -- 'shot' | 'nav' | 'click' | …
  storage_path text,             -- para prints (bucket 'imports', sob 'ext/')
  mime text,
  size_bytes integer,
  url text,                      -- página onde o evento aconteceu
  title text,                    -- título da página
  label text,                    -- rótulo (ex.: legenda do print, texto do clique)
  meta jsonb,
  created_at timestamptz not null default now()
);
create index extension_events_session_idx on public.extension_events (session_id, created_at);

alter table public.extension_events enable row level security;
-- Inserção é service-role (API autenticada por token). O dono lê os próprios
-- eventos (via a sessão) para conferir no admin.
create policy extension_events_read on public.extension_events for select to authenticated
  using (
    exists (
      select 1 from public.extension_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );
revoke all on public.extension_events from anon;

-- Mantém `extension_sessions.event_count` em dia, de forma atômica.
create function public.ext_bump_event_count() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  update public.extension_sessions
    set event_count = event_count + 1
    where id = new.session_id;
  return new;
end $$;

create trigger trg_ext_event_count
  after insert on public.extension_events
  for each row execute function public.ext_bump_event_count();
