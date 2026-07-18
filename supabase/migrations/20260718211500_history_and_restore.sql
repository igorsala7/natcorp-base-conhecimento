-- Fase 7.5 — Histórico e restauração. Snapshots de artigo, versões nomeadas/
-- protegidas, restauração append-only, esvaziar lixeira e política de retenção.

-- =====================================================================
-- article_versions — histórico append-only do conteúdo do artigo.
-- =====================================================================
create table public.article_versions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles (id) on delete cascade,
  version int not null,
  content_json jsonb not null,
  content_text text,
  label text,                        -- rótulo opcional ("Revisão jurídica jul/2026")
  protected boolean not null default false,  -- imune à política de retenção
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  unique (article_id, version)
);
create index article_versions_article_idx
  on public.article_versions (article_id, version desc);

alter table public.article_versions enable row level security;

-- Leitura para quem vê o conteúdo do espaço; escrita direta bloqueada
-- (só via funções SECURITY DEFINER abaixo). Editor vê o histórico e compara.
create policy article_versions_read on public.article_versions
  for select using (
    exists (
      select 1 from public.articles a
      join public.nodes n on n.id = a.node_id
      where a.id = article_versions.article_id
        and public.has_permission(auth.uid(), 'content.view', n.space_id)
    )
  );

-- =====================================================================
-- create_article_version — snapshot atômico do estado ATUAL do artigo.
-- Calcula a próxima versão, grava o snapshot e bumpa articles.version.
-- Exige content.edit no espaço. Retorna o número da nova versão.
-- =====================================================================
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
  if not public.has_permission(auth.uid(), 'content.edit', v_space) then
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

-- =====================================================================
-- rename_article_version — renomeia/protege uma versão existente.
-- =====================================================================
create or replace function public.rename_article_version(
  p_version_id uuid,
  p_label text,
  p_protected boolean
) returns void
  language plpgsql
  security definer
  set search_path = public
as $$
declare v_space uuid;
begin
  select n.space_id into v_space
  from public.article_versions av
  join public.articles a on a.id = av.article_id
  join public.nodes n on n.id = a.node_id
  where av.id = p_version_id;
  if v_space is null then raise exception 'Versão não encontrada'; end if;
  if not public.has_permission(auth.uid(), 'content.edit', v_space) then
    raise exception 'Sem permissão' using errcode = '42501';
  end if;
  update public.article_versions
  set label = p_label, protected = p_protected
  where id = p_version_id;
end $$;

-- =====================================================================
-- hard_delete_subtree — exclusão DEFINITIVA de uma subárvore da lixeira.
-- Só age sobre nós já excluídos (deleted_at not null). Cascata remove
-- articles e article_versions. Exige trash.empty.
-- =====================================================================
create or replace function public.hard_delete_subtree(p_node_id uuid)
  returns int
  language plpgsql
  security definer
  set search_path = public, extensions
as $$
declare v_space uuid; v_path extensions.ltree; v_count int;
begin
  select space_id, path into v_space, v_path
  from public.nodes where id = p_node_id;
  if v_space is null then raise exception 'Nó não encontrado'; end if;
  if not public.has_permission(auth.uid(), 'trash.empty', v_space) then
    raise exception 'Sem permissão para esvaziar a lixeira' using errcode = '42501';
  end if;
  delete from public.nodes
  where path <@ v_path and deleted_at is not null;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- =====================================================================
-- gc_versions — política de retenção. Mantém:
--   • todas as versões dos últimos 90 dias;
--   • depois, no máximo uma por dia, por até 1 ano;
--   • versões protegidas para sempre.
-- Chamável sob demanda (não agendada aqui). Retorna quantas removeu.
-- =====================================================================
create or replace function public.gc_versions()
  returns int
  language plpgsql
  security definer
  set search_path = public
as $$
declare v_count int;
begin
  with candidates as (
    select id,
      row_number() over (
        partition by article_id, date_trunc('day', created_at)
        order by version desc
      ) as rn_day
    from public.article_versions
    where not protected
      and created_at < now() - interval '90 days'
  ),
  to_delete as (
    -- Mantém 1 por dia até 1 ano; remove os extras do dia e tudo > 1 ano.
    select c.id from candidates c
    join public.article_versions av on av.id = c.id
    where c.rn_day > 1
       or av.created_at < now() - interval '1 year'
  )
  delete from public.article_versions where id in (select id from to_delete);
  get diagnostics v_count = row_count;
  return v_count;
end $$;
