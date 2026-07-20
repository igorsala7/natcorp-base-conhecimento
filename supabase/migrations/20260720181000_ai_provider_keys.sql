-- =====================================================================
-- CORREÇÃO da migration anterior.
--
-- Lá a chave morava em `ai_providers.api_key_enc` e a proteção era
-- `revoke select (api_key_enc) ... from authenticated`. **Não funciona neste
-- banco**: o Supabase concede privilégios de TABELA ao `authenticated`, e isso
-- sobrepõe a revogação por coluna. Verificado em
-- `information_schema.column_privileges`: a coluna seguia legível.
--
-- É o mesmo problema já enfrentado com `articles.draft_json`, e a solução que
-- funcionou é a mesma: TABELA SEPARADA, sem nenhum grant para `authenticated`.
-- Quem lê é o servidor com service-role (que ignora RLS e grants).
-- =====================================================================

create table public.ai_provider_keys (
  provider_id uuid primary key references public.ai_providers (id) on delete cascade,
  api_key_enc text not null,
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);

alter table public.ai_provider_keys enable row level security;

-- Nenhuma policy e nenhum grant: ninguém alcança esta tabela por SQL comum.
-- A escrita acontece pela função abaixo (security definer); a leitura, só pelo
-- servidor via service-role.
revoke all on public.ai_provider_keys from anon, authenticated;

-- Migra o que porventura já exista e elimina a coluna insegura.
insert into public.ai_provider_keys (provider_id, api_key_enc)
select id, api_key_enc from public.ai_providers where api_key_enc is not null
on conflict (provider_id) do nothing;

alter table public.ai_providers drop column api_key_enc;

-- Gravar a chave continua sendo privilégio de OWNER (nível 100).
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

  if p_key_enc is null then
    delete from public.ai_provider_keys where provider_id = p_provider_id;
  else
    insert into public.ai_provider_keys (provider_id, api_key_enc, updated_by, updated_at)
    values (p_provider_id, p_key_enc, auth.uid(), now())
    on conflict (provider_id) do update
      set api_key_enc = excluded.api_key_enc,
          updated_by = excluded.updated_by,
          updated_at = now();
  end if;
end $$;

revoke all on function public.set_ai_provider_key(uuid, text) from anon;

-- Para a tela saber se há chave, SEM entregar o valor.
create or replace function public.ai_provider_has_key(p_provider_id uuid)
  returns boolean
  language sql
  security definer
  stable
  set search_path = public
as $$
  select exists (select 1 from public.ai_provider_keys where provider_id = p_provider_id)
     and public.has_permission(auth.uid(), 'ai.configure', null);
$$;
