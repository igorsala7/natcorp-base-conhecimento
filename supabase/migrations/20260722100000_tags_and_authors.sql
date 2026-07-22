-- Tags por documentação + perfis públicos de autor (padrão HubSpot).
--
-- Tags: taxonomia transversal à árvore (um artigo pode ter N tags), com slug
-- único por documentação para o filtro público `?tag=`. Autor: perfil PÚBLICO
-- separado do profile interno — nome de exibição, slug e bio são editoriais,
-- não cadastrais; `nodes.author_id` é atribuição explícita (updated_by segue
-- sendo só rastro interno).

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  unique (space_id, slug)
);
create index tags_space_idx on public.tags (space_id);

create table public.node_tags (
  node_id uuid not null references public.nodes (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (node_id, tag_id)
);
create index node_tags_tag_idx on public.node_tags (tag_id);

create table public.author_profiles (
  id uuid primary key references public.profiles (id) on delete cascade,
  public_name text not null,
  slug text not null unique,
  avatar_url text,
  bio text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.nodes
  add column author_id uuid references public.author_profiles (id) on delete set null;

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.tags enable row level security;
alter table public.node_tags enable row level security;
alter table public.author_profiles enable row level security;

-- Equipe: leitura acompanha content.view; escrita acompanha content.edit.
create policy tags_read on public.tags
  for select to authenticated
  using (public.has_permission(auth.uid(), 'content.view', space_id));
create policy tags_write on public.tags
  for all to authenticated
  using (public.has_permission(auth.uid(), 'content.edit', space_id))
  with check (public.has_permission(auth.uid(), 'content.edit', space_id));

create policy node_tags_read on public.node_tags
  for select to authenticated
  using (exists (
    select 1 from public.nodes n
    where n.id = node_tags.node_id
      and public.has_permission(auth.uid(), 'content.view', n.space_id)
  ));
create policy node_tags_write on public.node_tags
  for all to authenticated
  using (exists (
    select 1 from public.nodes n
    where n.id = node_tags.node_id
      and public.has_permission(auth.uid(), 'content.edit', n.space_id)
  ))
  with check (exists (
    select 1 from public.nodes n
    where n.id = node_tags.node_id
      and public.has_permission(auth.uid(), 'content.edit', n.space_id)
  ));

-- Portal (anon): tags de documentação pública; vínculos só de nó publicado —
-- mesmo espírito de nodes_public_read.
create policy tags_public_read on public.tags
  for select to anon using (
    exists (
      select 1 from public.spaces s
      where s.id = tags.space_id and s.visibility = 'public'
    )
  );
create policy node_tags_public_read on public.node_tags
  for select to anon using (
    exists (
      select 1 from public.nodes n
      join public.spaces s on s.id = n.space_id
      where n.id = node_tags.node_id
        and n.deleted_at is null
        and n.status = 'published'
        and s.visibility = 'public'
    )
  );

-- Autores: o perfil público é exibido no portal, então anon lê os ativos.
-- Equipe inteira lê (o editor precisa do dropdown de atribuição); gestão do
-- cadastro é de quem gerencia usuários.
create policy authors_read on public.author_profiles
  for select to authenticated using (true);
create policy authors_public_read on public.author_profiles
  for select to anon using (active);
create policy authors_write on public.author_profiles
  for all to authenticated
  using (public.has_permission(auth.uid(), 'user.manage', null))
  with check (public.has_permission(auth.uid(), 'user.manage', null));
