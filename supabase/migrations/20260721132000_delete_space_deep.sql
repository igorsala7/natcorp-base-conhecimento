-- Exclusão DEFINITIVA de uma documentação (espaço), com tudo dentro.
--
-- O grosso já cascateia pelos FKs (`on delete cascade` conferido no banco):
-- nodes → articles/versões/rascunhos/feedback/views, chunks (embeddings),
-- widget_keys (chatbots) + escopos, knowledge_documents, conversations →
-- messages, import_jobs, assets, redirects, snippets, overlays, memberships
-- por espaço, segredos e histórico de slugs. `audit_log` NÃO referencia
-- spaces por FK — o histórico sobrevive, como deve.
--
-- O que a função acrescenta ao DELETE:
--  1. permissão `space.delete` checada AQUI (SECURITY DEFINER — não existe
--     policy de delete em spaces para clientes comuns);
--  2. trava de herança: espaço global com clientes pendurados não sai
--     (o FK parent_space_id é NO ACTION; a mensagem aqui é a versão humana);
--  3. contagens de retorno para a auditoria e a mensagem da tela.
--
-- Arquivos do Storage não saem daqui (SQL não fala com o Storage): a action
-- coleta os caminhos ANTES e remove depois que as linhas caírem.
create or replace function public.delete_space_deep(p_space_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clientes int;
  v_nodes int;
  v_chunks int;
  v_chatbots int;
  v_arquivos int;
  v_slug text;
begin
  if not public.has_permission(auth.uid(), 'space.delete', p_space_id) then
    raise exception 'Sem permissão para excluir esta documentação.';
  end if;

  select count(*) into v_clientes from public.spaces where parent_space_id = p_space_id;
  if v_clientes > 0 then
    raise exception 'Esta documentação tem % documentação(ões) de cliente herdando dela. Exclua-as primeiro.', v_clientes;
  end if;

  select slug into v_slug from public.spaces where id = p_space_id;
  if v_slug is null then
    raise exception 'Documentação não encontrada.';
  end if;

  select count(*) into v_nodes from public.nodes where space_id = p_space_id;
  select count(*) into v_chunks from public.chunks where space_id = p_space_id;
  select count(*) into v_chatbots from public.widget_keys where space_id = p_space_id;
  select count(*) into v_arquivos from public.knowledge_documents where space_id = p_space_id;

  -- Convites por espaço não têm FK para spaces — limpeza explícita.
  delete from public.invitations where space_id = p_space_id;

  delete from public.spaces where id = p_space_id;

  return jsonb_build_object(
    'slug', v_slug,
    'nodes', v_nodes,
    'chunks', v_chunks,
    'chatbots', v_chatbots,
    'arquivos', v_arquivos
  );
end;
$$;

grant execute on function public.delete_space_deep(uuid) to authenticated;
