-- Acesso à web dos assistentes de IA (scraping de sites).
--
-- Linha única (padrão de backup_settings). Dois interruptores independentes:
--  · authoring_enabled — superfícies de AUTORIA (Chat IA do editor, Estúdio):
--    o autor humano puxa uma fonte para redigir. Sem allowlist (admin confiável).
--  · reader_enabled — superfícies PÚBLICAS (portal, widget, API): o leitor cita
--    uma URL. Restrito à `allowlist` de domínios — allowlist VAZIA = nada é
--    buscado no leitor (trava contra virar proxy de scraping/SSRF de terceiros).
-- A proteção SSRF (IP público obrigatório, timeout, teto) vive no código e vale
-- para todas as superfícies; a allowlist é a trava adicional do lado público.
create table if not exists public.web_fetch_settings (
  id boolean primary key default true check (id),
  authoring_enabled boolean not null default true,
  reader_enabled boolean not null default false,
  allowlist text[] not null default '{}',   -- domínios permitidos no lado público
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

insert into public.web_fetch_settings (id) values (true) on conflict (id) do nothing;

alter table public.web_fetch_settings enable row level security;
drop policy if exists web_fetch_settings_rw on public.web_fetch_settings;
create policy web_fetch_settings_rw on public.web_fetch_settings for all to authenticated
  using (public.has_permission(auth.uid(), 'ai.configure', null))
  with check (public.has_permission(auth.uid(), 'ai.configure', null));
