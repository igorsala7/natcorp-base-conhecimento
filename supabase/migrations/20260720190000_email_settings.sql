-- =====================================================================
-- Configuração de envio de e-mail (Brevo ou SMTP genérico).
--
-- Hoje a aplicação NÃO envia e-mail: o convite só gera o link e quem envia é
-- o SMTP do próprio Supabase, fora do produto. Esta tabela é a base para o
-- envio passar a ser do sistema.
--
-- Mesma lição de `ai_provider_keys`: os SEGREDOS ficam em tabela separada,
-- sem grant para `authenticated`. Proteger por COLUNA não funciona neste banco.
-- =====================================================================

create table public.email_settings (
  -- Linha única. O CHECK impede uma segunda por engano — duas configurações
  -- silenciosamente concorrentes seriam impossíveis de diagnosticar.
  id boolean primary key default true check (id),
  transport text not null default 'off' check (transport in ('off', 'brevo', 'smtp')),
  from_name text not null default 'Base de Conhecimento',
  from_email text,
  smtp_host text,
  smtp_port int,
  smtp_user text,
  smtp_secure boolean not null default true,
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);

insert into public.email_settings (id) values (true) on conflict do nothing;

alter table public.email_settings enable row level security;

-- `integrations.manage` já existia em `permissions` (Admin técnico).
create policy email_settings_read on public.email_settings
  for select to authenticated using (
    public.has_permission(auth.uid(), 'integrations.manage', null)
  );
create policy email_settings_write on public.email_settings
  for all to authenticated using (
    public.has_permission(auth.uid(), 'integrations.manage', null)
  )
  with check (public.has_permission(auth.uid(), 'integrations.manage', null));

revoke all on public.email_settings from anon;

-- Segredos: fora do alcance de qualquer papel comum.
create table public.email_secrets (
  id boolean primary key default true check (id),
  brevo_api_key_enc text,
  smtp_pass_enc text,
  updated_at timestamptz not null default now()
);
insert into public.email_secrets (id) values (true) on conflict do nothing;

alter table public.email_secrets enable row level security;
revoke all on public.email_secrets from anon, authenticated;

-- Gravar segredo de e-mail: Owner (nível 100), como nas chaves de IA.
create or replace function public.set_email_secret(p_campo text, p_valor_enc text)
  returns void
  language plpgsql
  security definer
  set search_path = public, extensions
as $$
begin
  if public.max_role_level(auth.uid(), null) < 100 then
    raise exception 'Apenas o Owner pode alterar segredos de e-mail'
      using errcode = '42501';
  end if;
  if p_campo = 'brevo' then
    update public.email_secrets set brevo_api_key_enc = p_valor_enc, updated_at = now();
  elsif p_campo = 'smtp' then
    update public.email_secrets set smtp_pass_enc = p_valor_enc, updated_at = now();
  else
    raise exception 'Campo desconhecido: %', p_campo;
  end if;
end $$;

revoke all on function public.set_email_secret(text, text) from anon;

-- Para a tela saber SE há segredo, sem entregar o valor.
create or replace function public.email_has_secret(p_campo text)
  returns boolean
  language sql
  security definer
  stable
  set search_path = public
as $$
  select public.has_permission(auth.uid(), 'integrations.manage', null)
     and exists (
       select 1 from public.email_secrets
       where (p_campo = 'brevo' and brevo_api_key_enc is not null)
          or (p_campo = 'smtp' and smtp_pass_enc is not null)
     );
$$;
