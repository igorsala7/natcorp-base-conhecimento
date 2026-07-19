-- Itens opcionais — Proteção por senha de espaço (visibility='password').
-- Guarda o hash (bcrypt via pgcrypto) e expõe set/verify.

alter table public.spaces add column if not exists password_hash text;

-- Define/atualiza a senha do espaço (hash bcrypt). Exige space.manage.
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
  update public.spaces
    set password_hash = extensions.crypt(p_plain, extensions.gen_salt('bf'))
    where id = p_space_id;
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
  select password_hash into v_hash from public.spaces where id = p_space_id;
  if v_hash is null then return false; end if;
  return v_hash = extensions.crypt(p_plain, v_hash);
end $$;

grant execute on function public.verify_space_password(uuid, text) to anon, authenticated;
