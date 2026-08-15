-- CONJUNTO DE PERMISSÕES EM UMA CHAMADA
--
-- `has_permission` responde UMA pergunta por ida ao banco, e a camada TypeScript
-- ainda soma um `auth.getUser()` antes de cada uma — dois round-trips por
-- checagem. Enquanto a UI perguntava três ou quatro coisas por página, isso
-- passou despercebido.
--
-- Não passa mais: a sidebar nova decide a visibilidade de nove itens a cada
-- render, e o Cmd+K precisa filtrar ~40 destinos enquanto a pessoa digita. Fazer
-- isso com uma pergunta por vez são dezenas de idas ao banco para desenhar um
-- menu. Este é o pré-requisito da reforma da navegação, não uma otimização.
--
-- A semântica é a MESMA de `has_permission`, deliberadamente copiada linha a
-- linha: mesma tabela, mesmo filtro de expiração, e a mesma regra de escopo
-- (`m.space_id is null or m.space_id = p_space_id` — membership global vale para
-- qualquer espaço). Se as duas divergirem, a UI passa a mostrar o que o servidor
-- recusa, ou a esconder o que ele permite. As duas continuam batendo porque são
-- a mesma consulta com `exists` trocado por `select distinct`.
--
-- `security definer` pelo mesmo motivo da original: `memberships` está sob RLS, e
-- a função precisa enxergar as linhas do próprio usuário para decidir.
create or replace function public.permissions_of(
  p_user_id uuid,
  p_space_id uuid default null
) returns setof text
  language sql
  stable
  security definer
  set search_path = public
as $$
  select distinct p.key
  from memberships m
  join role_permissions rp on rp.role_id = m.role_id
  join permissions p on p.id = rp.permission_id
  where m.user_id = p_user_id
    and (m.expires_at is null or m.expires_at > now())
    and (m.space_id is null or m.space_id = p_space_id);
$$;

comment on function public.permissions_of(uuid, uuid) is
  'Todas as chaves de permissão do usuário no escopo. Mesma semântica de has_permission, em uma chamada — para a UI decidir menu e paleta sem uma ida ao banco por item.';

revoke all on function public.permissions_of(uuid, uuid) from public;
grant execute on function public.permissions_of(uuid, uuid) to authenticated;
