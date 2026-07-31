-- Configuração de INFRA/ESCALA no banco (tira do .env) — editável no admin.
-- Redis (cache distribuído) + limites de escala (semáforo, cota, disjuntor).
-- Singleton. O token do Redis é cifrado na aplicação (APP_ENCRYPTION_KEY).

create table if not exists infra_settings (
  id boolean primary key default true check (id),
  redis_rest_url text,               -- URL REST do Upstash (não secreta)
  redis_rest_token_enc text,         -- token cifrado (AES-GCM na app)
  max_concurrency_per_base int,      -- NULL = default do código/env
  daily_token_cap_per_base bigint,   -- NULL = sem cota diária
  lease_ttl_seconds int,
  cb_failures int,
  cb_window_ms int,
  cb_cooldown_ms int,
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);

insert into infra_settings (id) values (true) on conflict do nothing;

alter table infra_settings enable row level security; -- só service-role
