-- Fase 7 — Widget embutível + API pública. Chaves públicas por espaço,
-- allowlist de origem, rate limit durável (por IP e por chave).

-- =====================================================================
-- widget_keys — chave PÚBLICA (pk_...) vinculada a um único espaço.
-- Nunca alcança o Admin nem outro espaço: o escopo é o space_id.
-- =====================================================================
create table public.widget_keys (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  name text not null default 'Widget',
  public_key text not null unique,             -- ex.: pk_live_xxxxxxxx
  allowed_origins text[] not null default '{}',-- ex.: {'https://app.cliente.com'}
  rate_limit int not null default 30,          -- requisições por minuto (por IP e por chave)
  active boolean not null default true,
  config jsonb not null default '{}'::jsonb,    -- cor, avatar, boas-vindas, perguntas sugeridas, posição
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
create index widget_keys_space_idx on public.widget_keys (space_id);
create index widget_keys_pk_idx on public.widget_keys (public_key);

alter table public.widget_keys enable row level security;

-- Só quem tem widget.manage no espaço administra as chaves.
-- A API pública lê as chaves via service-role (bypassa RLS), nunca via anon.
create policy widget_keys_rw on public.widget_keys
  for all to authenticated using (
    public.has_permission(auth.uid(), 'widget.manage', space_id)
  )
  with check (public.has_permission(auth.uid(), 'widget.manage', space_id));

-- =====================================================================
-- Rate limit durável (janela fixa). Funciona em multi-instância/serverless
-- porque o estado vive no Postgres, não na memória do processo.
-- =====================================================================
create table public.rate_limits (
  bucket text not null,                 -- ex.: 'chat:key:<id>' ou 'chat:ip:<hash>'
  window_start timestamptz not null,    -- início da janela (truncado)
  count int not null default 0,
  primary key (bucket, window_start)
);
create index rate_limits_window_idx on public.rate_limits (window_start);

alter table public.rate_limits enable row level security;
-- Sem policies: acessível apenas via service-role (a API pública).

-- Registra um acesso ao bucket e diz se ainda está DENTRO do limite.
-- Retorna true quando permitido; false quando estourou p_max na janela.
create or replace function public.rate_limit_hit(
  p_bucket text,
  p_max int,
  p_window_seconds int default 60
) returns boolean
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_window timestamptz;
  v_count int;
begin
  -- Início da janela fixa: floor(now / janela) * janela.
  v_window := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limits (bucket, window_start, count)
  values (p_bucket, v_window, 1)
  on conflict (bucket, window_start)
    do update set count = public.rate_limits.count + 1
  returning count into v_count;

  return v_count <= p_max;
end;
$$;

-- Limpeza oportunista de janelas antigas (mantém a tabela pequena).
create or replace function public.rate_limits_gc() returns void
  language sql
  security definer
  set search_path = public
as $$
  delete from public.rate_limits where window_start < now() - interval '1 hour';
$$;
