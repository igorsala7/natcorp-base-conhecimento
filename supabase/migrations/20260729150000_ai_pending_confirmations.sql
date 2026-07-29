-- =====================================================================
-- Confirmações pendentes (fora-da-banda) para AÇÕES SENSÍVEIS — ex.: efetivar
-- um saque de antecipação. O servidor gera um CÓDIGO, envia por um canal que o
-- MODELO não vê (e-mail cadastrado do usuário) e guarda só o HASH aqui. A ação
-- só é liberada quando o usuário informa o código de volta e ele confere.
--
-- Deny-all: apenas a service-role (servidor) lê/escreve. Nada de anon/authenticated.
-- =====================================================================
create table public.ai_pending_confirmations (
  id uuid primary key default gen_random_uuid(),
  base_code text not null,
  subject text not null,          -- chave do usuário (ex.: "usuario:matricula")
  action text not null,           -- ex.: 'saque'
  detail text,                    -- ex.: valor
  code_hash text not null,        -- SHA-256 do código (nunca o código em claro)
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index ai_pending_confirmations_lookup
  on public.ai_pending_confirmations (base_code, subject, action);

alter table public.ai_pending_confirmations enable row level security;
revoke all on public.ai_pending_confirmations from anon, authenticated;
