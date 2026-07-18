-- Fase 2 — Portal público.
-- Leitura pública (anon) do conteúdo PUBLICADO em espaços PÚBLICOS, e a tabela
-- de redirects para manter URLs vivas quando o slug muda.

-- =====================================================================
-- 1. REDIRECTS (301 automático)
-- =====================================================================
create table public.redirects (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  from_path text not null,               -- caminho de slugs antigo (sem barra inicial)
  to_node_id uuid references public.nodes (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (space_id, from_path)
);

alter table public.redirects enable row level security;

create policy redirects_public_read on public.redirects
  for select to anon using (
    exists (
      select 1 from public.spaces s
      where s.id = redirects.space_id and s.visibility = 'public'
    )
  );
create policy redirects_auth_read on public.redirects
  for select to authenticated using (
    public.has_permission(auth.uid(), 'content.view', space_id)
  );
create policy redirects_manage on public.redirects
  for all to authenticated using (
    public.has_permission(auth.uid(), 'content.edit', space_id)
  )
  with check (public.has_permission(auth.uid(), 'content.edit', space_id));

-- =====================================================================
-- 2. RLS PÚBLICA (anon) — só publicado, só espaço público
-- =====================================================================
create policy spaces_public_read on public.spaces
  for select to anon using (visibility = 'public');

create policy nodes_public_read on public.nodes
  for select to anon using (
    deleted_at is null
    and status = 'published'
    and exists (
      select 1 from public.spaces s
      where s.id = nodes.space_id and s.visibility = 'public'
    )
  );

create policy articles_public_read on public.articles
  for select to anon using (
    exists (
      select 1 from public.nodes n
      join public.spaces s on s.id = n.space_id
      where n.id = articles.node_id
        and n.deleted_at is null
        and n.status = 'published'
        and s.visibility = 'public'
    )
  );

-- Snippets publicados (para transclusão no portal).
create policy snippets_public_read on public.snippets
  for select to anon using (
    exists (
      select 1 from public.spaces s
      where s.id = snippets.space_id and s.visibility = 'public'
    )
  );

-- =====================================================================
-- 3. FEEDBACK ("Isso foi útil?")
-- =====================================================================
create table public.article_feedback (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null references public.nodes (id) on delete cascade,
  helpful boolean not null,
  comment text,
  created_at timestamptz not null default now()
);
alter table public.article_feedback enable row level security;

-- Qualquer visitante pode registrar feedback de conteúdo publicado/público.
create policy feedback_insert on public.article_feedback
  for insert to anon, authenticated with check (
    exists (
      select 1 from public.nodes n
      join public.spaces s on s.id = n.space_id
      where n.id = article_feedback.node_id
        and n.status = 'published'
        and s.visibility = 'public'
    )
  );
-- Leitura do feedback exige permissão (analytics do admin — Fase 8).
create policy feedback_read on public.article_feedback
  for select to authenticated using (
    exists (
      select 1 from public.nodes n
      where n.id = article_feedback.node_id
        and public.has_permission(auth.uid(), 'content.view', n.space_id)
    )
  );

-- =====================================================================
-- 4. Torna o espaço global público (decisão do usuário para a Fase 2)
-- =====================================================================
update public.spaces set visibility = 'public' where slug = 'global';
