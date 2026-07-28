-- Fase 5.0 — Fundação da extensão de navegador.
-- A extensão é uma ferramenta INTERNA de autoria: cada membro gera um TOKEN
-- pessoal (revogável) e a extensão o usa nas APIs de ingestão. NUNCA cookies.

-- ── Tokens pessoais ───────────────────────────────────────────────────────────
create table public.extension_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text,                        -- ex.: "Notebook do João"
  token_hash text not null unique,   -- SHA-256 do token (o valor cru só aparece 1x)
  token_prefix text not null,        -- ex.: "ext_live_1a2b3c…" (para exibir na lista)
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index extension_tokens_user_idx on public.extension_tokens (user_id, created_at desc);

alter table public.extension_tokens enable row level security;
-- O dono gerencia os próprios tokens (mesma ideia de prompts_usuario_sistema).
create policy extension_tokens_rw on public.extension_tokens for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
revoke all on public.extension_tokens from anon;

-- ── Sessões de captura ────────────────────────────────────────────────────────
-- Criadas pela API (service-role, autenticada pelo token). O espaço-alvo é
-- escolhido só na finalização (5.2), por isso nullable aqui.
create table public.extension_sessions (
  id uuid primary key default gen_random_uuid(),
  token_id uuid references public.extension_tokens (id) on delete set null,
  user_id uuid not null references auth.users (id) on delete cascade,
  space_id uuid references public.spaces (id) on delete set null,
  title text,
  status text not null default 'active',   -- 'active' | 'finalized' | 'canceled'
  event_count integer not null default 0,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);
create index extension_sessions_user_idx on public.extension_sessions (user_id, created_at desc);

alter table public.extension_sessions enable row level security;
-- O dono vê as próprias sessões no admin. Inserção/atualização é service-role (API).
create policy extension_sessions_read on public.extension_sessions for select to authenticated
  using (user_id = auth.uid());
revoke all on public.extension_sessions from anon;
