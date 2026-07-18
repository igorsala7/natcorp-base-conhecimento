-- Soft delete / restauração de subárvore inteira (lixeira).
-- Excluir uma categoria manda a subárvore junto; restaurar traz de volta.

create or replace function public.soft_delete_subtree(p_node_id uuid)
  returns int
  language plpgsql
  security definer
  set search_path = public, extensions
as $$
declare
  v_space uuid;
  v_path extensions.ltree;
  v_count int;
begin
  select space_id, path into v_space, v_path
  from public.nodes where id = p_node_id and deleted_at is null;
  if v_space is null then
    raise exception 'Nó não encontrado';
  end if;
  if not public.has_permission(auth.uid(), 'content.delete', v_space) then
    raise exception 'Sem permissão para excluir' using errcode = '42501';
  end if;

  update public.nodes
  set deleted_at = now()
  where path <@ v_path and deleted_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

create or replace function public.restore_subtree(p_node_id uuid)
  returns int
  language plpgsql
  security definer
  set search_path = public, extensions
as $$
declare
  v_space uuid;
  v_path extensions.ltree;
  v_count int;
begin
  select space_id, path into v_space, v_path
  from public.nodes where id = p_node_id;
  if v_space is null then
    raise exception 'Nó não encontrado';
  end if;
  if not public.has_permission(auth.uid(), 'content.restore', v_space) then
    raise exception 'Sem permissão para restaurar' using errcode = '42501';
  end if;

  update public.nodes
  set deleted_at = null
  where path <@ v_path and deleted_at is not null;
  get diagnostics v_count = row_count;
  return v_count;
end $$;
