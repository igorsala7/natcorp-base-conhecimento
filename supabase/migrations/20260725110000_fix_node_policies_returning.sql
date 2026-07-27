-- =====================================================================
-- Correção: INSERT ... RETURNING em `nodes` violava a RLS.
--
-- As policies de `nodes` passaram a usar has_permission_node(id), que faz
-- self-JOIN em `nodes` pelo id para descobrir space_id/path. No `INSERT ...
-- RETURNING` (todo `.insert().select()` do app: importação, criar na árvore,
-- estúdio, cópia) a linha recém-inserida AINDA NÃO é visível ao snapshot da
-- função — o self-join volta vazio, a leitura é negada e o insert falha com
-- "new row violates row-level security policy for table nodes".
--
-- Correção: uma variante que recebe space_id e path DA PRÓPRIA LINHA (colunas
-- disponíveis, pois o trigger trg_set_node_path é BEFORE INSERT), sem self-join.
-- =====================================================================
create or replace function public.has_permission_node_row(
  p_user_id uuid,
  p_permission_key text,
  p_space_id uuid,
  p_path extensions.ltree
) returns boolean
  language sql stable security definer set search_path = public, extensions
as $$
  select exists (
    select 1
    from memberships m
    join role_permissions rp on rp.role_id = m.role_id
    join permissions p on p.id = rp.permission_id
    where m.user_id = p_user_id
      and p.key = p_permission_key
      and (m.expires_at is null or m.expires_at > now())
      and (m.space_id is null or m.space_id = p_space_id)
      and (
        m.node_id is null
        or p_path <@ (select sn.path from public.nodes sn where sn.id = m.node_id)
      )
  );
$$;

grant execute on function public.has_permission_node_row(uuid, text, uuid, extensions.ltree)
  to anon, authenticated;

-- nodes: policies da PRÓPRIA tabela usam as colunas da linha (space_id, path),
-- sem self-join. (articles_* seguem em has_permission_node(node_id): o nó já
-- existe quando o artigo é inserido, então o join encontra a linha.)
drop policy if exists nodes_read on public.nodes;
create policy nodes_read on public.nodes
  for select using (public.has_permission_node_row(auth.uid(), 'content.view', space_id, path));

drop policy if exists nodes_update on public.nodes;
create policy nodes_update on public.nodes
  for update using (public.has_permission_node_row(auth.uid(), 'content.edit', space_id, path))
  with check (public.has_permission_node_row(auth.uid(), 'content.edit', space_id, path));

drop policy if exists nodes_delete on public.nodes;
create policy nodes_delete on public.nodes
  for delete using (public.has_permission_node_row(auth.uid(), 'content.delete', space_id, path));
