-- Multi-tenant (B): SEMÁFORO de concorrência + COTA de tokens por base, para
-- fair-share entre os clientes e teto de custo. Distribuído (funciona com N
-- réplicas web/worker) — o estado vive no Postgres.

-- Slots em uso (leases com expiração — auto-recuperáveis se um processo cair).
create table if not exists ai_leases (
  id uuid primary key default gen_random_uuid(),
  tenant text not null,
  expires_at timestamptz not null
);
create index if not exists ai_leases_tenant on ai_leases (tenant);
create index if not exists ai_leases_expires on ai_leases (expires_at);
alter table ai_leases enable row level security; -- só service-role

-- Limites por base (override); NULL = usa o default (env). tenant = p_base ou 'sp:<space_id>'.
create table if not exists tenant_limits (
  tenant text primary key,
  max_concurrency int,
  daily_token_cap bigint,
  updated_at timestamptz not null default now()
);
alter table tenant_limits enable row level security; -- só service-role

-- Adquire um slot de concorrência para o tenant. Serializa por tenant (advisory
-- lock) para não estourar o teto em corrida. Devolve o id do lease OU NULL (cheio).
create or replace function public.ai_slot_acquire(p_tenant text, p_max int, p_ttl_seconds int)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_count int;
begin
  perform pg_advisory_xact_lock(hashtext('ai_slot:' || p_tenant));
  delete from ai_leases where expires_at < now();
  select count(*) into v_count from ai_leases where tenant = p_tenant;
  if v_count >= p_max then
    return null;
  end if;
  insert into ai_leases (tenant, expires_at)
  values (p_tenant, now() + make_interval(secs => p_ttl_seconds))
  returning id into v_id;
  return v_id;
end;
$$;

-- Libera um slot.
create or replace function public.ai_slot_release(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from ai_leases where id = p_id;
$$;

-- Tokens consumidos por uma base nas últimas 24h (para a cota).
create or replace function public.ai_daily_tokens(p_tenant text)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(total_tokens), 0)::bigint
  from ai_usage
  where p_base = p_tenant and created_at >= now() - interval '24 hours';
$$;

revoke all on function public.ai_slot_acquire(text, int, int) from anon;
revoke all on function public.ai_slot_release(uuid) from anon;
revoke all on function public.ai_daily_tokens(text) from anon;
