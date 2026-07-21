-- =====================================================================
-- Senha de documentação: hash em tabela isolada + rate limit.
--
-- PROBLEMA 1 — o hash era legível por qualquer autenticado.
--   `spaces.password_hash` vivia em public.spaces, cuja policy é
--       spaces_read: for select using (has_permission(uid,'content.view', id))
--   SEM restrição de coluna. Um Leitor fazia `select password_hash from spaces`
--   pelo PostgREST e levava o bcrypt para quebrar offline.
--   Este projeto já aprendeu a lição em `ai_provider_keys` e `email_secrets`:
--   proteger por COLUNA não funciona neste banco, o segredo tem que sair da
--   tabela. A senha de espaço tinha ficado para trás.
--
-- PROBLEMA 2 — força bruta sem limite nenhum.
--   `grant execute on verify_space_password to anon` permitia chamar
--   POST /rest/v1/rpc/verify_space_password direto no PostgREST, contornando o
--   Next inteiro, na velocidade que a rede aguentasse. Só o custo do bcrypt
--   segurava. Agora passa pelo `rate_limit_hit` que a API do widget já usa.
-- =====================================================================

create table public.space_secrets (
  space_id uuid primary key references public.spaces (id) on delete cascade,
  password_hash text not null,
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);

-- Migra o que já existe antes de derrubar a coluna.
insert into public.space_secrets (space_id, password_hash)
select id, password_hash from public.spaces where password_hash is not null
on conflict (space_id) do nothing;

alter table public.spaces drop column if exists password_hash;

-- Deny-all deliberado: ninguém lê esta tabela por consulta. Só as funções
-- SECURITY DEFINER abaixo tocam nela. Mesmo padrão de ai_provider_keys.
alter table public.space_secrets enable row level security;
revoke all on public.space_secrets from anon, authenticated;

-- Define/atualiza a senha (bcrypt). Exige space.manage.
create or replace function public.set_space_password(p_space_id uuid, p_plain text)
  returns void
  language plpgsql
  security definer
  set search_path = public, extensions
as $$
begin
  if not public.has_permission(auth.uid(), 'space.manage', p_space_id) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  if p_plain is null or length(p_plain) = 0 then
    delete from public.space_secrets where space_id = p_space_id;
    return;
  end if;

  insert into public.space_secrets (space_id, password_hash, updated_by, updated_at)
  values (p_space_id, extensions.crypt(p_plain, extensions.gen_salt('bf')), auth.uid(), now())
  on conflict (space_id) do update
    set password_hash = excluded.password_hash,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at;
end $$;

-- Verifica a senha (para o portal, anon). Nunca expõe o hash.
create or replace function public.verify_space_password(p_space_id uuid, p_plain text)
  returns boolean
  language plpgsql
  security definer
  set search_path = public, extensions
as $$
declare v_hash text;
begin
  -- 10 tentativas por minuto POR DOCUMENTAÇÃO. O teto vive aqui, e não só na
  -- server action, porque a RPC é chamável direto no PostgREST — limitar
  -- apenas no Next não protegeria nada.
  if not public.rate_limit_hit('space_pwd:' || p_space_id::text, 10, 60) then
    raise exception 'Muitas tentativas de senha' using errcode = '54000';
  end if;

  select password_hash into v_hash from public.space_secrets where space_id = p_space_id;
  if v_hash is null then return false; end if;
  return v_hash = extensions.crypt(p_plain, v_hash);
end $$;

-- A tela de configurações precisa saber SE há senha, sem poder ler o hash.
create or replace function public.space_has_password(p_space_id uuid)
  returns boolean
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if not public.has_permission(auth.uid(), 'space.manage', p_space_id) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  return exists (select 1 from public.space_secrets where space_id = p_space_id);
end $$;

grant execute on function public.verify_space_password(uuid, text) to anon, authenticated;
grant execute on function public.space_has_password(uuid) to authenticated;
