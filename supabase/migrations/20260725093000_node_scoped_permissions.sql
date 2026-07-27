-- =====================================================================
-- Permissões cientes de NÓ (subárvore).
--
-- `memberships.node_id` já existe (NULL = espaço inteiro; preenchido =
-- restringe a uma subárvore). Até aqui era IGNORADO. Aqui ele passa a valer:
-- uma regra (membership) com node_id só concede a permissão DENTRO daquela
-- subárvore, resolvida pelo caminho materializado `nodes.path` (ltree; o índice
-- GiST `nodes_path_gist` já existe).
--
-- Compatibilidade: quem tem node_id NULL (todos os usuários atuais) mantém o
-- acesso de espaço inteiro — o comportamento não muda para eles.
-- =====================================================================

-- has_permission ciente do NÓ alvo (um nó existente).
create or replace function public.has_permission_node(
  p_user_id uuid,
  p_permission_key text,
  p_node_id uuid
) returns boolean
  language sql stable security definer set search_path = public, extensions
as $$
  select exists (
    select 1
    from memberships m
    join role_permissions rp on rp.role_id = m.role_id
    join permissions p on p.id = rp.permission_id
    join nodes tn on tn.id = p_node_id
    where m.user_id = p_user_id
      and p.key = p_permission_key
      and (m.expires_at is null or m.expires_at > now())
      and (m.space_id is null or m.space_id = tn.space_id)
      and (
        m.node_id is null
        or tn.path <@ (select sn.path from public.nodes sn where sn.id = m.node_id)
      )
  );
$$;

-- Para o INSERT de um nó (que ainda não tem `path`): a permissão é avaliada
-- sob o PAI. Sem pai (raiz do espaço) exige uma regra de espaço inteiro.
create or replace function public.has_permission_child(
  p_user_id uuid,
  p_permission_key text,
  p_parent_id uuid,
  p_space_id uuid
) returns boolean
  language sql stable security definer set search_path = public
as $$
  select case
    when p_parent_id is null then exists (
      select 1
      from memberships m
      join role_permissions rp on rp.role_id = m.role_id
      join permissions p on p.id = rp.permission_id
      where m.user_id = p_user_id
        and p.key = p_permission_key
        and (m.expires_at is null or m.expires_at > now())
        and (m.space_id is null or m.space_id = p_space_id)
        and m.node_id is null
    )
    else public.has_permission_node(p_user_id, p_permission_key, p_parent_id)
  end;
$$;

-- Responsáveis por aprovar um nó: usuários com review.approve cujo escopo
-- (espaço + subárvore opcional) cobre o nó. Alimenta o e-mail de solicitação.
create or replace function public.approvers_for_node(p_node_id uuid)
  returns table(user_id uuid)
  language sql stable security definer set search_path = public, extensions
as $$
  select distinct m.user_id
  from memberships m
  join role_permissions rp on rp.role_id = m.role_id
  join permissions p on p.id = rp.permission_id
  join nodes tn on tn.id = p_node_id
  where p.key = 'review.approve'
    and (m.expires_at is null or m.expires_at > now())
    and (m.space_id is null or m.space_id = tn.space_id)
    and (
      m.node_id is null
      or tn.path <@ (select sn.path from public.nodes sn where sn.id = m.node_id)
    );
$$;

grant execute on function public.has_permission_node(uuid, text, uuid) to anon, authenticated;
grant execute on function public.has_permission_child(uuid, text, uuid, uuid) to anon, authenticated;
grant execute on function public.approvers_for_node(uuid) to authenticated;

-- =====================================================================
-- RLS de conteúdo: troca has_permission (espaço) por has_permission_node (nó).
-- As policies anon do portal (nodes_public_read/articles_public_read) NÃO são
-- tocadas — o portal segue lendo publicado em espaço público normalmente.
-- =====================================================================
drop policy if exists nodes_read on public.nodes;
create policy nodes_read on public.nodes
  for select using (public.has_permission_node(auth.uid(), 'content.view', id));

drop policy if exists nodes_insert on public.nodes;
create policy nodes_insert on public.nodes
  for insert with check (public.has_permission_child(auth.uid(), 'content.create', parent_id, space_id));

drop policy if exists nodes_update on public.nodes;
create policy nodes_update on public.nodes
  for update using (public.has_permission_node(auth.uid(), 'content.edit', id))
  with check (public.has_permission_node(auth.uid(), 'content.edit', id));

drop policy if exists nodes_delete on public.nodes;
create policy nodes_delete on public.nodes
  for delete using (public.has_permission_node(auth.uid(), 'content.delete', id));

drop policy if exists articles_read on public.articles;
create policy articles_read on public.articles
  for select using (public.has_permission_node(auth.uid(), 'content.view', articles.node_id));

drop policy if exists articles_write on public.articles;
create policy articles_write on public.articles
  for all using (public.has_permission_node(auth.uid(), 'content.edit', articles.node_id))
  with check (public.has_permission_node(auth.uid(), 'content.edit', articles.node_id));

-- =====================================================================
-- RPCs de revisão: mesmas transições, mas checando o NÓ (subárvore) e não só o
-- espaço. Assim um Editor/Revisor com regra restrita só age dentro do escopo.
-- =====================================================================
create or replace function public.submit_for_review(p_node_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare v_space uuid;
begin
  select space_id into v_space from public.nodes where id = p_node_id;
  if v_space is null then raise exception 'Nó não encontrado'; end if;
  if not public.has_permission_node(auth.uid(), 'content.edit', p_node_id) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  update public.nodes set status = 'review' where id = p_node_id;
  insert into public.review_comments (node_id, author_id, kind) values (p_node_id, auth.uid(), 'submit');
end $$;

create or replace function public.approve_review(p_node_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare v_space uuid; v_article uuid; v_next int; v_now timestamptz := now();
begin
  select n.space_id, a.id into v_space, v_article
  from public.nodes n left join public.articles a on a.node_id = n.id
  where n.id = p_node_id;
  if v_space is null then raise exception 'Nó não encontrado'; end if;
  if not public.has_permission_node(auth.uid(), 'review.approve', p_node_id) then
    raise exception 'Sem permissão para aprovar' using errcode = '42501';
  end if;

  update public.nodes set status = 'published', published_at = v_now where id = p_node_id;
  if v_article is not null then
    update public.articles set published_at = v_now where id = v_article;
    select coalesce(max(version), 0) + 1 into v_next
    from public.article_versions where article_id = v_article;
    insert into public.article_versions
      (article_id, version, content_json, content_text, label, created_by)
    select v_article, v_next, a.content_json, a.content_text, 'Aprovado', auth.uid()
    from public.articles a where a.id = v_article;
    update public.articles set version = v_next where id = v_article;
  end if;
  insert into public.review_comments (node_id, author_id, kind) values (p_node_id, auth.uid(), 'approve');
end $$;

create or replace function public.reject_review(p_node_id uuid, p_comment text)
  returns void language plpgsql security definer set search_path = public as $$
declare v_space uuid;
begin
  select space_id into v_space from public.nodes where id = p_node_id;
  if v_space is null then raise exception 'Nó não encontrado'; end if;
  if not public.has_permission_node(auth.uid(), 'review.reject', p_node_id) then
    raise exception 'Sem permissão para rejeitar' using errcode = '42501';
  end if;
  update public.nodes set status = 'draft' where id = p_node_id;
  insert into public.review_comments (node_id, author_id, kind, body)
  values (p_node_id, auth.uid(), 'reject', p_comment);
end $$;
