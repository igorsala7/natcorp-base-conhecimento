-- Item #5 — API de gestão (cadastros/ações) via CHAVE SECRETA (server-to-server).
-- A chave `sk_live_...` é guardada só como hash SHA-256; os escopos são as
-- permissões RBAC já existentes (content.view, content.publish, …). A resolução
-- da chave (rotas /api/manage) roda por service-role; a UI de gestão usa sessão.

create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  key_hash text not null unique,          -- SHA-256 hex do segredo (nunca o segredo)
  key_prefix text not null,               -- prefixo p/ exibir (ex.: "sk_live_ab…")
  scopes text[] not null default '{}',    -- permissões RBAC concedidas à chave
  active boolean not null default true,
  last_used_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table api_keys enable row level security;

-- Só quem gerencia usuários (nível alto) cria/revoga chaves. O segredo nunca é
-- lido de volta (a coluna guarda só o hash). Service-role ignora RLS (resolução).
drop policy if exists api_keys_manage on api_keys;
create policy api_keys_manage on api_keys for all to authenticated
  using (has_permission(auth.uid(), 'user.manage', null))
  with check (has_permission(auth.uid(), 'user.manage', null));

create index if not exists api_keys_active_idx on api_keys (active) where active;
