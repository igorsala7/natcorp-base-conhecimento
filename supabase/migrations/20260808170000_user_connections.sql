-- =====================================================================
-- CONEXÕES DE CONTA POR USUÁRIO — o token pessoal do Microsoft/Google
--
-- Uma linha por (credencial, pessoa). A chave é a CREDENCIAL, não o provedor,
-- e isso é a garantia de isolamento entre clientes: cada empresa cadastra o
-- próprio registro no Entra (`ai_base_credentials` é por `base_id`, e
-- `ai_bases.base_code` é o `p_base` do token de rastreio, 1:1 com a empresa).
-- Amarrando a conexão à credencial, um usuário do cliente A não alcança o
-- registro do cliente B nem por engano de junção — não existe caminho no
-- esquema que ligue os dois.
--
-- `p_usuario` vem do token cifrado de rastreio, isto é, do sistema anfitrião
-- afirmando quem é a pessoa. Por decisão do produto (08/08/2026) confiamos
-- nessa afirmação, sem exigir que o e-mail da conta Microsoft bata com um
-- e-mail verificado do anfitrião. A consequência é explícita: se o anfitrião
-- emitir um token com o `p_usuario` errado, a conta conectada vai para a pessoa
-- errada. Guardamos `account_email` justamente para essa auditoria ser possível
-- depois.
--
-- ── Por que a tabela de token é separada ────────────────────────────────
-- Mesmo motivo de `ai_base_credential_secrets` e `ai_provider_keys`: no
-- Supabase o `revoke select (coluna)` não segura contra o grant de tabela que o
-- papel `authenticated` recebe. Coluna sensível dentro da tabela consultável é
-- proteção que não existe. E o conteúdo aqui é mais sensível que o de lá — um
-- refresh_token de Microsoft vale a caixa de e-mail de uma pessoa, não o acesso
-- a uma API de RH.
-- =====================================================================

create table public.user_connections (
  id uuid primary key default gen_random_uuid(),
  credential_id uuid not null references public.ai_base_credentials (id) on delete cascade,
  -- Denormalizado da credencial: o relatório e a tela filtram por cliente sem
  -- dois joins, e o índice de isolamento fica direto.
  base_id uuid not null references public.ai_bases (id) on delete cascade,
  provider text not null check (provider in ('microsoft', 'google')),
  -- Identidade do anfitrião (p_usuario do token de rastreio).
  p_usuario text not null,
  -- Quem de fato consentiu, do lado do provedor. Não é o critério de vínculo
  -- (ver acima) — é a trilha para descobrir uma ligação errada.
  account_email text,
  account_name text,
  -- Escopos EFETIVAMENTE concedidos, que podem ser menos que os pedidos.
  scopes text[] not null default '{}',
  access_expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Uma conexão ATIVA por pessoa por credencial. Índice parcial em vez de
-- `unique (credential_id, p_usuario)`: reconectar depois de revogar tem de
-- funcionar, e o histórico de revogações fica.
create unique index user_connections_ativa_idx
  on public.user_connections (credential_id, p_usuario)
  where revoked_at is null;
create index user_connections_base_idx on public.user_connections (base_id, provider);

comment on table public.user_connections is
  'Conta Microsoft/Google que um usuário conectou, por credencial (= por cliente). O token fica em user_connection_tokens.';

-- ── O token, isolado ────────────────────────────────────────────────────
create table public.user_connection_tokens (
  connection_id uuid primary key references public.user_connections (id) on delete cascade,
  refresh_enc text not null,
  access_enc text,
  updated_at timestamptz not null default now()
);

comment on table public.user_connection_tokens is
  'refresh_token (e access_token em cache) cifrados. Tabela ISOLADA e SEM grant para papel comum — só service-role a alcança. Nunca adicionar coluna consultável aqui.';

-- ── Nonce do consentimento ──────────────────────────────────────────────
-- O `state` do OAuth é de uso único e vive no BANCO, não numa assinatura.
-- Assinar exigiria uma chave, e a chave-mestra desta aplicação está exposta em
-- `.env` versionado num repositório público — uma assinatura com ela não
-- provaria nada. Um nonce aleatório, gravado no servidor, gasto na primeira
-- troca e expirado em 10 minutos não depende de segredo nenhum.
create table public.oauth_states (
  nonce text primary key,
  credential_id uuid not null references public.ai_base_credentials (id) on delete cascade,
  p_usuario text not null,
  -- Origem que abriu o popup, para o callback devolver a mensagem só para ela.
  origin text,
  created_at timestamptz not null default now(),
  used_at timestamptz
);
create index oauth_states_limpeza_idx on public.oauth_states (created_at);

comment on table public.oauth_states is
  'Nonce de uso único do fluxo de consentimento (10 min). Uso único e TTL curto substituem a assinatura do `state`.';

-- ── RLS ─────────────────────────────────────────────────────────────────
alter table public.user_connections enable row level security;
alter table public.user_connection_tokens enable row level security;
alter table public.oauth_states enable row level security;

-- Leitura só para quem administra integrações (a tela "quem conectou o quê").
-- A escrita é toda do servidor, via service-role, fora do RLS — como as demais
-- tabelas de segredo deste módulo.
create policy user_connections_read on public.user_connections
  for select to authenticated using (
    public.has_permission(auth.uid(), 'integrations.manage', null)
  );

-- Sem POLICY NENHUMA nas duas abaixo: nem admin lê token por SQL de aplicação.
revoke all on public.user_connections from anon;
revoke all on public.user_connection_tokens from anon, authenticated;
revoke all on public.oauth_states from anon, authenticated;
