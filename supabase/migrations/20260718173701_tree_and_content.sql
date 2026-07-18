-- Fase 1 — Árvore de conteúdo e artigos.
-- spaces (versão global vs. cliente), nodes (árvore única com ltree + ordenação
-- fracionária), articles (documento TipTap), snippets (transclusão) e assets.

-- Utilitário compartilhado: mantém updated_at em dia.
create or replace function public.touch_updated_at()
  returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- =====================================================================
-- 1. SPACES
-- =====================================================================
create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  type text not null default 'global' check (type in ('global', 'client')),
  parent_space_id uuid references public.spaces (id),
  visibility text not null default 'private'
    check (visibility in ('public', 'private', 'password')),
  theme jsonb not null default '{}'::jsonb,
  custom_domain text unique,
  created_at timestamptz not null default now()
);

-- FK pendente da Fase 0.5: memberships/space restrito a um espaço real.
alter table public.memberships
  add constraint memberships_space_fk
  foreign key (space_id) references public.spaces (id) on delete cascade;

-- =====================================================================
-- 2. NODES (categorias, artigos, links e divisores na MESMA árvore)
-- =====================================================================
create table public.nodes (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  parent_id uuid references public.nodes (id) on delete cascade,
  type text not null check (type in ('folder', 'article', 'link', 'divider')),
  title text not null default 'Sem título',
  slug text not null,
  path extensions.ltree,               -- caminho materializado (mover subárvore = 1 UPDATE)
  position text not null,              -- índice fracionário (string base62)
  icon text,
  link_url text,                       -- para type = 'link'
  status text not null default 'draft'
    check (status in ('draft', 'review', 'published')),
  visibility text,                     -- herda do espaço quando null
  deleted_at timestamptz,              -- soft delete (lixeira)
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index nodes_slug_unique
  on public.nodes (space_id, parent_id, slug)
  where deleted_at is null;
create index nodes_path_gist on public.nodes using gist (path);
create index nodes_space_parent_idx on public.nodes (space_id, parent_id);
create index nodes_space_pos_idx on public.nodes (space_id, parent_id, position);

-- Rótulo ltree a partir do uuid (ltree só aceita [a-zA-Z0-9_]; tiramos hífens).
create or replace function public.node_label(p_id uuid)
  returns text language sql immutable as $$
  select replace(p_id::text, '-', '');
$$;

-- Define o path no insert a partir do path do pai.
create or replace function public.set_node_path()
  returns trigger language plpgsql
  set search_path = public, extensions as $$
declare
  parent_path extensions.ltree;
begin
  if new.parent_id is null then
    new.path := public.node_label(new.id)::extensions.ltree;
  else
    select path into parent_path from public.nodes where id = new.parent_id;
    if parent_path is null then
      raise exception 'Nó pai % sem path', new.parent_id;
    end if;
    new.path := parent_path || public.node_label(new.id);
  end if;
  return new;
end $$;

create trigger trg_set_node_path
  before insert on public.nodes
  for each row execute function public.set_node_path();

create trigger trg_nodes_updated_at
  before update on public.nodes
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- 3. ARTICLES (um por nó do tipo 'article')
-- =====================================================================
create table public.articles (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null unique references public.nodes (id) on delete cascade,
  content_json jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  content_html text,                 -- cache de render (invalidado no publish)
  content_text text,                 -- texto puro (busca/chunking — Fase 3)
  excerpt text,
  cover_image text,
  meta jsonb not null default '{}'::jsonb,   -- SEO
  version int not null default 1,
  published_at timestamptz,
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);

create trigger trg_articles_updated_at
  before update on public.articles
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- 4. SNIPPETS (conteúdo transcluído — editar num lugar, atualiza em todos)
-- =====================================================================
create table public.snippets (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  key text not null,
  title text not null,
  content_json jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (space_id, key)
);

create trigger trg_snippets_updated_at
  before update on public.snippets
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- 5. ASSETS (imagens/vídeos; dedup por checksum)
-- =====================================================================
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  space_id uuid references public.spaces (id) on delete cascade,
  storage_path text not null,
  mime text,
  width int,
  height int,
  size_bytes bigint,
  alt_text text,
  checksum text,
  created_at timestamptz not null default now()
);
create index assets_checksum_idx on public.assets (space_id, checksum);

-- =====================================================================
-- 6. RLS — leitura/edição atreladas a has_permission no escopo do espaço
-- =====================================================================
alter table public.spaces enable row level security;
alter table public.nodes enable row level security;
alter table public.articles enable row level security;
alter table public.snippets enable row level security;
alter table public.assets enable row level security;

-- spaces: quem tem content.view no espaço enxerga; gestão exige space.manage.
create policy spaces_read on public.spaces
  for select using (public.has_permission(auth.uid(), 'content.view', id));
create policy spaces_manage on public.spaces
  for all using (public.has_permission(auth.uid(), 'space.manage', id))
  with check (public.has_permission(auth.uid(), 'space.manage', id));

-- nodes
create policy nodes_read on public.nodes
  for select using (public.has_permission(auth.uid(), 'content.view', space_id));
create policy nodes_insert on public.nodes
  for insert with check (public.has_permission(auth.uid(), 'content.create', space_id));
create policy nodes_update on public.nodes
  for update using (public.has_permission(auth.uid(), 'content.edit', space_id))
  with check (public.has_permission(auth.uid(), 'content.edit', space_id));
create policy nodes_delete on public.nodes
  for delete using (public.has_permission(auth.uid(), 'content.delete', space_id));

-- articles (escopo herdado do nó)
create policy articles_read on public.articles
  for select using (exists (
    select 1 from public.nodes n
    where n.id = articles.node_id
      and public.has_permission(auth.uid(), 'content.view', n.space_id)
  ));
create policy articles_write on public.articles
  for all using (exists (
    select 1 from public.nodes n
    where n.id = articles.node_id
      and public.has_permission(auth.uid(), 'content.edit', n.space_id)
  ))
  with check (exists (
    select 1 from public.nodes n
    where n.id = articles.node_id
      and public.has_permission(auth.uid(), 'content.edit', n.space_id)
  ));

-- snippets
create policy snippets_read on public.snippets
  for select using (public.has_permission(auth.uid(), 'content.view', space_id));
create policy snippets_write on public.snippets
  for all using (public.has_permission(auth.uid(), 'content.edit', space_id))
  with check (public.has_permission(auth.uid(), 'content.edit', space_id));

-- assets
create policy assets_read on public.assets
  for select using (public.has_permission(auth.uid(), 'content.view', space_id));
create policy assets_write on public.assets
  for all using (public.has_permission(auth.uid(), 'content.edit', space_id))
  with check (public.has_permission(auth.uid(), 'content.edit', space_id));

-- =====================================================================
-- 7. STORAGE — bucket de assets (leitura pública; escrita autenticada)
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('assets', 'assets', true)
on conflict (id) do nothing;

create policy "assets_public_read"
  on storage.objects for select
  using (bucket_id = 'assets');
create policy "assets_authenticated_write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'assets');
create policy "assets_authenticated_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'assets');

-- =====================================================================
-- 8. SEED — espaço global inicial
-- =====================================================================
insert into public.spaces (slug, name, type, visibility)
values ('global', 'Documentação Global', 'global', 'private')
on conflict (slug) do nothing;
