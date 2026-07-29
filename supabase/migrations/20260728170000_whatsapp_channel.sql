-- =====================================================================
-- CANAL WHATSAPP (Meta Cloud API) — G1: configuração
--
-- Um ÚNICO número oficial (da sua empresa). Todos os usuários de todos os
-- clientes falam com ele. Quem é o usuário — e de QUAL cliente/base — vem de uma
-- API de IDENTIFICAÇÃO: recebe o telefone do remetente e devolve a identidade
-- (p_*) + o base_code. Daí em diante reusa bases/tools/agentes (Fases A–F).
--
-- Config em linha única (como email_settings). Segredos (app_secret,
-- access_token, verify_token e a credencial da API de identificação) numa tabela
-- ISOLADA, sem grant para authenticated (lição de ai_provider_keys/email_secrets).
-- Permissão: integrations.manage (Admin técnico), igual ao resto do módulo.
-- =====================================================================

create table public.whatsapp_settings (
  -- Linha única — o CHECK impede uma segunda por engano.
  id boolean primary key default true check (id),
  active boolean not null default false,
  -- Credenciais Meta NÃO secretas (são IDs).
  phone_number_id text,
  waba_id text,
  business_account_id text,
  -- Resposta quando o telefone do remetente NÃO é identificado pela API.
  unidentified_message text not null default
    'Não consegui identificar seu cadastro por este número. Fale com o suporte para vincular seu WhatsApp.',
  -- API de IDENTIFICAÇÃO (telefone → identidade + base). Auth/segredo à parte.
  identity_endpoint text,
  identity_method text not null default 'GET'
    check (identity_method in ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')),
  identity_auth_type text not null default 'none'
    check (identity_auth_type in ('none', 'basic', 'api_key', 'bearer', 'oauth2')),
  -- Como o telefone do remetente é enviado à API.
  identity_phone_param text not null default 'telefone',
  identity_phone_local text not null default 'query'
    check (identity_phone_local in ('query', 'path', 'body', 'header')),
  -- Mapa da RESPOSTA da API → nossos campos:
  --   { "base_code":"empresa", "p_matricula":"matricula", "p_empresa":"cod_emp",
  --     "p_usuario":"login", "p_perfil":"perfil", "p_portal":"portal", "nome":"nome" }
  identity_map jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);

insert into public.whatsapp_settings (id) values (true) on conflict do nothing;

alter table public.whatsapp_settings enable row level security;

create policy whatsapp_settings_read on public.whatsapp_settings
  for select to authenticated using (
    public.has_permission(auth.uid(), 'integrations.manage', null)
  );
create policy whatsapp_settings_write on public.whatsapp_settings
  for all to authenticated using (
    public.has_permission(auth.uid(), 'integrations.manage', null)
  )
  with check (public.has_permission(auth.uid(), 'integrations.manage', null));

revoke all on public.whatsapp_settings from anon;

-- Segredos: fora do alcance de qualquer papel comum (só service-role lê).
create table public.whatsapp_secrets (
  id boolean primary key default true check (id),
  app_secret_enc text,       -- valida a assinatura X-Hub-Signature-256 do webhook
  access_token_enc text,     -- envia mensagens pela Cloud API
  verify_token_enc text,     -- valida o handshake GET do webhook
  identity_secret_enc text,  -- credencial (JSON cifrado) da API de identificação
  updated_at timestamptz not null default now()
);
insert into public.whatsapp_secrets (id) values (true) on conflict do nothing;

alter table public.whatsapp_secrets enable row level security;
revoke all on public.whatsapp_secrets from anon, authenticated;

-- Gravar/limpar segredo: privilégio de integrations.manage (como as credenciais
-- de base deste módulo). p_valor_enc nulo limpa o campo.
create or replace function public.set_whatsapp_secret(p_campo text, p_valor_enc text)
  returns void
  language plpgsql
  security definer
  set search_path = public, extensions
as $$
begin
  if not public.has_permission(auth.uid(), 'integrations.manage', null) then
    raise exception 'Sem permissão para alterar segredos do WhatsApp'
      using errcode = '42501';
  end if;
  if p_campo = 'app_secret' then
    update public.whatsapp_secrets set app_secret_enc = p_valor_enc, updated_at = now();
  elsif p_campo = 'access_token' then
    update public.whatsapp_secrets set access_token_enc = p_valor_enc, updated_at = now();
  elsif p_campo = 'verify_token' then
    update public.whatsapp_secrets set verify_token_enc = p_valor_enc, updated_at = now();
  elsif p_campo = 'identity' then
    update public.whatsapp_secrets set identity_secret_enc = p_valor_enc, updated_at = now();
  else
    raise exception 'Campo desconhecido: %', p_campo;
  end if;
end $$;

revoke all on function public.set_whatsapp_secret(text, text) from anon;

-- Para a tela saber SE há cada segredo, sem entregar o valor.
create or replace function public.whatsapp_has_secret(p_campo text)
  returns boolean
  language sql
  security definer
  stable
  set search_path = public
as $$
  select public.has_permission(auth.uid(), 'integrations.manage', null)
     and exists (
       select 1 from public.whatsapp_secrets
       where (p_campo = 'app_secret' and app_secret_enc is not null)
          or (p_campo = 'access_token' and access_token_enc is not null)
          or (p_campo = 'verify_token' and verify_token_enc is not null)
          or (p_campo = 'identity' and identity_secret_enc is not null)
     );
$$;

revoke all on function public.whatsapp_has_secret(text) from anon;
