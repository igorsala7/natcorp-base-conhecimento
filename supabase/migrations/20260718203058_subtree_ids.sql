-- IDs de um nó e toda a sua subárvore (para publicar/mover/reindexar em cascata).
create or replace function public.subtree_ids(p_node_id uuid)
  returns table (id uuid, type text)
  language sql
  stable
  security definer
  set search_path = public, extensions
as $$
  select n.id, n.type
  from public.nodes n,
       (select path from public.nodes where id = p_node_id) root
  where n.path <@ root.path
    and n.deleted_at is null;
$$;
