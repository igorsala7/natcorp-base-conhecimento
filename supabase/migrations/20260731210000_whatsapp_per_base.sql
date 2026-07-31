-- WhatsApp por cliente (Fase 3): canais por base (conta Meta própria por cliente),
-- com um canal PADRÃO. A config atual (linha única) vira o padrão (base_code='').
-- O webhook roteia pelo phone_number_id que recebeu a mensagem.

-- whatsapp_settings: singleton (id boolean) → multi-linha por base.
alter table public.whatsapp_settings add column if not exists base_code text not null default '';
alter table public.whatsapp_settings drop column if exists id cascade; -- remove PK singleton + check(id)
alter table public.whatsapp_settings add constraint whatsapp_settings_pkey primary key (base_code);
create unique index if not exists whatsapp_settings_phone_uk
  on public.whatsapp_settings (phone_number_id)
  where phone_number_id is not null and phone_number_id <> '';

-- whatsapp_secrets: idem.
alter table public.whatsapp_secrets add column if not exists base_code text not null default '';
alter table public.whatsapp_secrets drop column if exists id cascade;
alter table public.whatsapp_secrets add constraint whatsapp_secrets_pkey primary key (base_code);

-- RPC de segredo ganha a base e faz upsert da linha do canal.
drop function if exists public.set_whatsapp_secret(text, text);
create or replace function public.set_whatsapp_secret(p_base text, p_campo text, p_valor_enc text)
  returns void
  language plpgsql
  security definer
  set search_path = public, extensions
as $$
begin
  if not public.has_permission(auth.uid(), 'integrations.manage', null) then
    raise exception 'Sem permissão para alterar segredos do WhatsApp' using errcode = '42501';
  end if;
  insert into public.whatsapp_secrets (base_code) values (p_base) on conflict (base_code) do nothing;
  if p_campo = 'app_secret' then
    update public.whatsapp_secrets set app_secret_enc = p_valor_enc, updated_at = now() where base_code = p_base;
  elsif p_campo = 'access_token' then
    update public.whatsapp_secrets set access_token_enc = p_valor_enc, updated_at = now() where base_code = p_base;
  elsif p_campo = 'verify_token' then
    update public.whatsapp_secrets set verify_token_enc = p_valor_enc, updated_at = now() where base_code = p_base;
  elsif p_campo = 'identity' then
    update public.whatsapp_secrets set identity_secret_enc = p_valor_enc, updated_at = now() where base_code = p_base;
  else
    raise exception 'Campo desconhecido: %', p_campo;
  end if;
end $$;

revoke all on function public.set_whatsapp_secret(text, text, text) from anon;
