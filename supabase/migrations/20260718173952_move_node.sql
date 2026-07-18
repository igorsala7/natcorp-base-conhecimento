-- Move um nó (e reordena): atualiza parent_id + position e reescreve o path
-- da subárvore inteira em um único UPDATE (graças ao ltree). Checa a permissão
-- tree.reorganize no escopo do espaço. SECURITY DEFINER para tocar a subárvore.
create or replace function public.move_node(
  p_node_id uuid,
  p_new_parent_id uuid,
  p_position text
) returns void
  language plpgsql
  security definer
  set search_path = public, extensions
as $$
declare
  v_space uuid;
  v_old_path extensions.ltree;
  v_new_parent_path extensions.ltree;
  v_new_path extensions.ltree;
  v_old_levels int;
begin
  select space_id, path into v_space, v_old_path
  from public.nodes where id = p_node_id;
  if v_space is null then
    raise exception 'Nó não encontrado';
  end if;

  if not public.has_permission(auth.uid(), 'tree.reorganize', v_space) then
    raise exception 'Sem permissão para reorganizar a árvore'
      using errcode = '42501';
  end if;

  if p_new_parent_id is not null then
    select path into v_new_parent_path
    from public.nodes where id = p_new_parent_id;
    if v_new_parent_path is null then
      raise exception 'Nó de destino inválido';
    end if;
    -- não pode virar filho de si mesmo / da própria subárvore
    if v_new_parent_path <@ v_old_path then
      raise exception 'Não é possível mover um nó para dentro dele mesmo';
    end if;
    v_new_path := v_new_parent_path || public.node_label(p_node_id);
  else
    v_new_path := public.node_label(p_node_id)::extensions.ltree;
  end if;

  v_old_levels := nlevel(v_old_path);

  -- parent/position do nó movido
  update public.nodes
  set parent_id = p_new_parent_id, position = p_position, updated_at = now()
  where id = p_node_id;

  -- reescreve os descendentes (a parte após o rótulo do nó é preservada)
  update public.nodes
  set path = v_new_path || subpath(path, v_old_levels)
  where path <@ v_old_path and id <> p_node_id;

  -- por fim, o próprio nó
  update public.nodes set path = v_new_path where id = p_node_id;
end $$;
