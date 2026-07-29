-- =====================================================================
-- MÓDULO DE INTEGRAÇÕES DE IA (Fase A — fundação)
--
-- Permite ao chatbot consultar sistemas externos (ERP/RH/financeiro) via
-- APIs, com a IA escolhendo qual API usar e quais parâmetros passar. Três
-- cadastros:
--   1. Bases/Clientes   → ai_bases            (1:1 com uma documentação)
--   2. APIs/Tools        → ai_tools + ai_base_tools (catálogo global + ativação/URL por base)
--   3. Agentes           → ai_agents + ai_agent_tools (especialistas por módulo)
--
-- Credenciais (OAuth2/basic/api_key) são POR BASE e SENSÍVEIS: seguem a mesma
-- proteção de `ai_provider_keys`/`space_tracking_keys` — tabela de segredo
-- ISOLADA, sem grant para anon/authenticated, cifrada em repouso na aplicação
-- (`lib/crypto/secrets.ts`). Só o servidor (service-role) lê; a escrita passa
-- por função `security definer` com checagem de permissão.
--
-- Permissão: reusa `integrations.manage` (Admin técnico, nível 80) — já existe
-- em `permissions` desde a Fase 0.5. Nenhuma permissão nova.
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 1. BASES / CLIENTES
-- `base_code` = o p_base que o backend do cliente manda no token de rastreio.
-- É a âncora de resolução em runtime (token → base) e identifica a EMPRESA/cliente
-- 1:1 (cada empresa tem um base_code).
--
-- NÃO há vínculo com documentação: o acesso a documentações é MUITOS-PARA-MUITOS
-- (docs compartilhadas entre clientes + eventual doc privada de uma empresa) e é
-- tratado à parte (visibilidade de `spaces` / memberships), fora deste módulo.
-- ─────────────────────────────────────────────────────────────────────
create table public.ai_bases (
  id uuid primary key default gen_random_uuid(),
  base_code text not null unique,
  name text not null,
  active boolean not null default true,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_bases_active_idx on public.ai_bases (active);

-- ─────────────────────────────────────────────────────────────────────
-- 2. CREDENCIAIS POR BASE (metadados — o SEGREDO fica na tabela isolada abaixo)
-- Cada base tem seu(s) conjunto(s) de credenciais (ex.: "OAuth ERP"), com seu
-- próprio token_url/client_id/client_secret. `auth_type` diz como autenticar.
-- ─────────────────────────────────────────────────────────────────────
create table public.ai_base_credentials (
  id uuid primary key default gen_random_uuid(),
  base_id uuid not null references public.ai_bases (id) on delete cascade,
  name text not null,
  auth_type text not null check (auth_type in ('none', 'basic', 'api_key', 'bearer', 'oauth2')),
  active boolean not null default true,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (base_id, name)
);
create index ai_base_credentials_base_idx on public.ai_base_credentials (base_id);

-- Segredo da credencial: JSON cifrado { token_url, client_id, client_secret,
-- username, password, api_key, … } conforme o auth_type. Tabela ISOLADA porque
-- no Supabase o `revoke select (coluna)` não segura contra o grant de tabela do
-- `authenticated` (lição de ai_provider_keys). Ninguém a alcança por SQL comum.
create table public.ai_base_credential_secrets (
  credential_id uuid primary key references public.ai_base_credentials (id) on delete cascade,
  secret_enc text not null,
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────
-- 3. CATÁLOGO DE APIS/TOOLS (global — igual para todos os clientes)
-- A `base_url` e a credencial são por base (ai_base_tools); aqui mora só o que
-- é comum: caminho, método, parâmetros e a DESCRIÇÃO que direciona a IA.
-- ─────────────────────────────────────────────────────────────────────
create table public.ai_tools (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  -- Texto que o modelo lê para decidir QUANDO usar esta tool. Capricho aqui =
  -- acerto de roteamento.
  description text not null,
  method text not null default 'GET' check (method in ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')),
  -- Caminho relativo à base_url, com placeholders {param}. Ex.: '/ferias/{matricula}'
  path_template text not null default '',
  auth_type text not null default 'oauth2'
    check (auth_type in ('none', 'basic', 'api_key', 'bearer', 'oauth2')),
  -- params: array de definições de parâmetro. Ex.:
  --   [{ "nome":"matricula","tipo":"string","origem":"identidade",
  --      "obrigatorio":true,"mascara":null,"descricao":"Matrícula do colaborador" },
  --    { "nome":"data_ini","tipo":"date","origem":"modelo",
  --      "obrigatorio":true,"mascara":"dd/MM/yyyy","descricao":"Início do período" }]
  -- origem: 'identidade' (injetado do token, NUNCA do modelo) | 'modelo' | 'fixo'.
  -- tipo: 'string' | 'number' | 'date' | 'enum' | 'boolean'.
  params jsonb not null default '[]'::jsonb,
  -- Dica opcional de como a IA deve interpretar/resumir o retorno.
  response_hint text,
  active boolean not null default true,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_tools_active_idx on public.ai_tools (active);

-- Ativação da tool POR BASE + endpoint (base_url) + qual credencial usar.
-- Sem linha aqui = a API não existe para aquela base (o agente nem a enxerga).
create table public.ai_base_tools (
  base_id uuid not null references public.ai_bases (id) on delete cascade,
  tool_id uuid not null references public.ai_tools (id) on delete cascade,
  enabled boolean not null default true,
  base_url text,
  credential_id uuid references public.ai_base_credentials (id) on delete set null,
  primary key (base_id, tool_id)
);
create index ai_base_tools_tool_idx on public.ai_base_tools (tool_id);

-- ─────────────────────────────────────────────────────────────────────
-- 4. AGENTES (especialistas por módulo) + tools vinculadas
-- Modelo do agente reusa `ai_providers` (provider_id + model). model nulo =
-- fallback para a finalidade padrão de chat (resolveAi). `parent_agent_id`
-- monta a hierarquia (orquestrador → especialista).
-- ─────────────────────────────────────────────────────────────────────
create table public.ai_agents (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  -- Descrição usada pelo ROTEADOR para escolher o agente certo.
  description text not null,
  provider_id uuid references public.ai_providers (id) on delete set null,
  model text,
  system_prompt text not null default '',
  parent_agent_id uuid references public.ai_agents (id) on delete set null,
  -- Permissão exigida para acionar este agente (nullable = sem restrição extra).
  scope_permission text,
  priority int not null default 0,
  active boolean not null default true,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_agents_parent_idx on public.ai_agents (parent_agent_id);
create index ai_agents_active_idx on public.ai_agents (active);

create table public.ai_agent_tools (
  agent_id uuid not null references public.ai_agents (id) on delete cascade,
  tool_id uuid not null references public.ai_tools (id) on delete cascade,
  primary key (agent_id, tool_id)
);
create index ai_agent_tools_tool_idx on public.ai_agent_tools (tool_id);

-- =====================================================================
-- RLS — cadastros de configuração
-- Escopo GLOBAL (space_id nulo): quem tem `integrations.manage` administra o
-- módulo. Padrão idêntico ao de ai_providers/ai_assignments.
-- =====================================================================
alter table public.ai_bases                 enable row level security;
alter table public.ai_base_credentials      enable row level security;
alter table public.ai_base_credential_secrets enable row level security;
alter table public.ai_tools                 enable row level security;
alter table public.ai_base_tools            enable row level security;
alter table public.ai_agents                enable row level security;
alter table public.ai_agent_tools           enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'ai_bases', 'ai_base_credentials', 'ai_tools', 'ai_base_tools', 'ai_agents', 'ai_agent_tools'
  ] loop
    execute format(
      'create policy %1$s_read on public.%1$I for select to authenticated '
      'using (public.has_permission(auth.uid(), ''integrations.manage'', null));', t);
    execute format(
      'create policy %1$s_write on public.%1$I for all to authenticated '
      'using (public.has_permission(auth.uid(), ''integrations.manage'', null)) '
      'with check (public.has_permission(auth.uid(), ''integrations.manage'', null));', t);
    execute format('revoke all on public.%1$I from anon;', t);
  end loop;
end $$;

-- Tabela de segredo: nenhuma policy, nenhum grant. Só service-role lê; a escrita
-- é pela função abaixo.
revoke all on public.ai_base_credential_secrets from anon, authenticated;

-- =====================================================================
-- Gravar/apagar o segredo da credencial (o UPDATE direto está barrado pela
-- ausência de grant). Privilégio de `integrations.manage` (Admin técnico) —
-- é ele quem gerencia integrações e chaves neste produto.
-- =====================================================================
create or replace function public.set_base_credential_secret(p_credential_id uuid, p_secret_enc text)
  returns void
  language plpgsql
  security definer
  set search_path = public, extensions
as $$
begin
  if not public.has_permission(auth.uid(), 'integrations.manage', null) then
    raise exception 'Sem permissão para alterar credenciais de integração'
      using errcode = '42501';
  end if;

  if p_secret_enc is null then
    delete from public.ai_base_credential_secrets where credential_id = p_credential_id;
  else
    insert into public.ai_base_credential_secrets (credential_id, secret_enc, updated_by, updated_at)
    values (p_credential_id, p_secret_enc, auth.uid(), now())
    on conflict (credential_id) do update
      set secret_enc = excluded.secret_enc,
          updated_by = excluded.updated_by,
          updated_at = now();
  end if;
end $$;

revoke all on function public.set_base_credential_secret(uuid, text) from anon;

-- Para a tela saber se a credencial tem segredo, SEM entregar o valor.
create or replace function public.base_credential_has_secret(p_credential_id uuid)
  returns boolean
  language sql
  security definer
  stable
  set search_path = public
as $$
  select exists (select 1 from public.ai_base_credential_secrets where credential_id = p_credential_id)
     and public.has_permission(auth.uid(), 'integrations.manage', null);
$$;

revoke all on function public.base_credential_has_secret(uuid) from anon;
