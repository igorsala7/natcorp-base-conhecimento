-- Ao excluir conteúdo (soft delete → lixeira), remover também os embeddings do
-- RAG (tabela chunks) na hora — some da busca e do assistente imediatamente e
-- não fica ocupando o índice durante a retenção da lixeira. (Hard delete já
-- removia via FK on delete cascade; aqui cobrimos o soft delete.)

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

  -- Remove os embeddings/chunks do RAG de toda a subárvore.
  delete from public.chunks
  where node_id in (select id from public.nodes where path <@ v_path);

  update public.nodes
  set deleted_at = now()
  where path <@ v_path and deleted_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end $$;
