-- WhatsApp por PROVEDOR: além da Meta Cloud API, permitir Evolution API
-- (não-oficial, self-hosted). Cada canal (base) escolhe o provider.
--   provider='meta'      → phone_number_id + tokens da Meta (colunas atuais)
--   provider='evolution' → evolution_url + evolution_instance; a apikey da
--                          instância reaproveita whatsapp_secrets.access_token_enc.

alter table public.whatsapp_settings
  add column if not exists provider text not null default 'meta',
  add column if not exists evolution_url text,
  add column if not exists evolution_instance text;

alter table public.whatsapp_settings drop constraint if exists whatsapp_settings_provider_check;
alter table public.whatsapp_settings
  add constraint whatsapp_settings_provider_check check (provider in ('meta', 'evolution'));

-- Roteamento do webhook Evolution é pela instância → precisa ser única.
create unique index if not exists whatsapp_settings_evo_instance_uidx
  on public.whatsapp_settings (evolution_instance)
  where evolution_instance is not null and evolution_instance <> '';
