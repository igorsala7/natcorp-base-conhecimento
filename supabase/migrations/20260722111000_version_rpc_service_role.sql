-- O agendador de publicação (worker, service-role) precisa criar o snapshot
-- obrigatório de versão — mas create_article_version só aceitava usuário com
-- content.edit, e com service-role auth.uid() é NULL: a publicação agendada
-- saía SEM snapshot, em silêncio. service_role passa; created_by fica null
-- (o audit da ação registra que foi o agendador).

create or replace function public.create_article_version(
  p_node_id uuid,
  p_label text default null,
  p_protected boolean default false
) returns int
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_space uuid;
  v_article_id uuid;
  v_next int;
begin
  select n.space_id, a.id into v_space, v_article_id
  from public.nodes n
  join public.articles a on a.node_id = n.id
  where n.id = p_node_id;
  if v_article_id is null then raise exception 'Artigo não encontrado'; end if;
  if not (
    public.has_permission(auth.uid(), 'content.edit', v_space)
    or auth.role() = 'service_role'
  ) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;

  select coalesce(max(version), 0) + 1 into v_next
  from public.article_versions where article_id = v_article_id;

  insert into public.article_versions
    (article_id, version, content_json, content_text, label, protected, created_by)
  select v_article_id, v_next, a.content_json, a.content_text, p_label, p_protected, auth.uid()
  from public.articles a where a.id = v_article_id;

  update public.articles set version = v_next where id = v_article_id;
  return v_next;
end $$;
