-- =====================================================================
-- Provedores de IA cadastráveis e escolha de qual serve para quê.
--
-- Substitui a configuração fixa em env var (AI_PROVIDER/CHAT_MODEL/…), que
-- exigia deploy para trocar. As env vars continuam valendo como FALLBACK
-- enquanto não houver registro aqui — nada muda de comportamento no dia 1.
-- =====================================================================

create table public.ai_providers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('anthropic', 'openai', 'google')),
  -- Cifrada na APLICAÇÃO (AES-256-GCM, `lib/crypto/secrets.ts`), nunca aqui.
  -- Com pgcrypto a chave-mestra viajaria como parâmetro de SQL e cairia em
  -- `pg_stat_statements` e nos logs.
  api_key_enc text,
  -- Gateway/proxy compatível com a API do provedor (Azure OpenAI, LiteLLM…).
  base_url text,
  active boolean not null default true,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
create index ai_providers_active_idx on public.ai_providers (active);

create table public.ai_assignments (
  -- Uma linha por finalidade: é a tabela que responde "qual IA faz o quê".
  purpose text primary key
    check (purpose in ('chat', 'embedding', 'import_structure', 'import_layout')),
  provider_id uuid not null references public.ai_providers (id) on delete cascade,
  model text not null,
  params jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.ai_providers enable row level security;
alter table public.ai_assignments enable row level security;

-- =====================================================================
-- RLS. `ai.configure` já existia em `permissions` desde a Fase 0.5 (concedida
-- ao Admin técnico) — nenhuma permissão nova foi criada.
--
-- Escopo GLOBAL: has_permission com space_id nulo.
-- =====================================================================
create policy ai_providers_read on public.ai_providers
  for select to authenticated using (
    public.has_permission(auth.uid(), 'ai.configure', null)
  );
create policy ai_providers_write on public.ai_providers
  for all to authenticated using (
    public.has_permission(auth.uid(), 'ai.configure', null)
  )
  with check (public.has_permission(auth.uid(), 'ai.configure', null));

create policy ai_assignments_read on public.ai_assignments
  for select to authenticated using (
    public.has_permission(auth.uid(), 'ai.configure', null)
  );
create policy ai_assignments_write on public.ai_assignments
  for all to authenticated using (
    public.has_permission(auth.uid(), 'ai.configure', null)
  )
  with check (public.has_permission(auth.uid(), 'ai.configure', null));

revoke all on public.ai_providers from anon;
revoke all on public.ai_assignments from anon;

-- A RLS libera a LINHA, não a coluna: um Admin técnico faria `select
-- api_key_enc` e levaria o texto cifrado embora. Revogar a coluna fecha isso —
-- quem precisa do valor é o servidor, via service-role (que ignora RLS).
revoke select (api_key_enc) on public.ai_providers from authenticated;

-- =====================================================================
-- Gravar a chave é privilégio de OWNER (nível 100), acima do `ai.configure`.
-- Feito por função porque o UPDATE direto está barrado pela revogação acima.
-- =====================================================================
create or replace function public.set_ai_provider_key(p_provider_id uuid, p_key_enc text)
  returns void
  language plpgsql
  security definer
  set search_path = public, extensions
as $$
begin
  if public.max_role_level(auth.uid(), null) < 100 then
    raise exception 'Apenas o Owner pode alterar chaves de API'
      using errcode = '42501';
  end if;
  update public.ai_providers set api_key_enc = p_key_enc where id = p_provider_id;
end $$;

revoke all on function public.set_ai_provider_key(uuid, text) from anon;
