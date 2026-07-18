-- Fase 8 — Fluxo de aprovação. draft → review → published, com comentários.
-- O Revisor (nível 20) NÃO tem content.edit, então as transições vivem em
-- funções SECURITY DEFINER que checam review.approve / review.reject.

create table public.review_comments (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null references public.nodes (id) on delete cascade,
  author_id uuid references auth.users (id),
  kind text not null default 'comment' check (kind in ('comment', 'approve', 'reject', 'submit')),
  body text,
  created_at timestamptz not null default now()
);
create index review_comments_node_idx on public.review_comments (node_id, created_at);

alter table public.review_comments enable row level security;

-- Lê quem vê o conteúdo do espaço; escreve quem tem review.comment.
create policy review_comments_read on public.review_comments
  for select using (
    exists (
      select 1 from public.nodes n
      where n.id = review_comments.node_id
        and public.has_permission(auth.uid(), 'content.view', n.space_id)
    )
  );
create policy review_comments_insert on public.review_comments
  for insert with check (
    author_id = auth.uid() and exists (
      select 1 from public.nodes n
      where n.id = review_comments.node_id
        and public.has_permission(auth.uid(), 'review.comment', n.space_id)
    )
  );

-- =====================================================================
-- submit_for_review — Editor envia o rascunho para revisão. Exige content.edit.
-- =====================================================================
create or replace function public.submit_for_review(p_node_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare v_space uuid;
begin
  select space_id into v_space from public.nodes where id = p_node_id;
  if v_space is null then raise exception 'Nó não encontrado'; end if;
  if not public.has_permission(auth.uid(), 'content.edit', v_space) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  update public.nodes set status = 'review' where id = p_node_id;
  insert into public.review_comments (node_id, author_id, kind) values (p_node_id, auth.uid(), 'submit');
end $$;

-- =====================================================================
-- approve_review — Revisor aprova: publica e grava snapshot. Exige review.approve.
-- =====================================================================
create or replace function public.approve_review(p_node_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare v_space uuid; v_article uuid; v_next int; v_now timestamptz := now();
begin
  select n.space_id, a.id into v_space, v_article
  from public.nodes n left join public.articles a on a.node_id = n.id
  where n.id = p_node_id;
  if v_space is null then raise exception 'Nó não encontrado'; end if;
  if not public.has_permission(auth.uid(), 'review.approve', v_space) then
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

-- =====================================================================
-- reject_review — Revisor rejeita: volta a rascunho + comentário. Exige review.reject.
-- =====================================================================
create or replace function public.reject_review(p_node_id uuid, p_comment text)
  returns void language plpgsql security definer set search_path = public as $$
declare v_space uuid;
begin
  select space_id into v_space from public.nodes where id = p_node_id;
  if v_space is null then raise exception 'Nó não encontrado'; end if;
  if not public.has_permission(auth.uid(), 'review.reject', v_space) then
    raise exception 'Sem permissão para rejeitar' using errcode = '42501';
  end if;
  update public.nodes set status = 'draft' where id = p_node_id;
  insert into public.review_comments (node_id, author_id, kind, body)
  values (p_node_id, auth.uid(), 'reject', p_comment);
end $$;
