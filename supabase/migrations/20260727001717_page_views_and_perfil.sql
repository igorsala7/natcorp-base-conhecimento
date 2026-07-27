-- (1) p_perfil: 6º parâmetro de rastreio, junto dos demais na conversa.
alter table public.conversations add column if not exists p_perfil text;

-- (2) Rastreio de NAVEGAÇÃO no portal: cada acesso a uma documentação (home),
-- diretório ou artigo, com os parâmetros de quem acessou. Inserção pelo servidor
-- (service-role, via /api/portal/track); leitura no admin sob content.view.
create table if not exists public.page_views (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  node_id uuid references public.nodes(id) on delete set null, -- null = home da documentação
  path text,
  title text,
  kind text not null default 'article' check (kind in ('home', 'folder', 'article')),
  session_id text,
  p_base text,
  p_usuario text,
  p_portal text,
  p_empresa text,
  p_matricula text,
  p_perfil text,
  created_at timestamptz not null default now()
);

create index if not exists page_views_space_idx on public.page_views (space_id, created_at desc);
create index if not exists page_views_node_idx on public.page_views (node_id);
create index if not exists page_views_empresa_idx on public.page_views (space_id, p_empresa);
create index if not exists page_views_usuario_idx on public.page_views (space_id, p_usuario);

alter table public.page_views enable row level security;

-- Leitura: mesma regra das conversas (has_permission content.view no espaço).
-- A inserção é service-role (ignora RLS) — sem policy de anon/insert.
drop policy if exists page_views_read on public.page_views;
create policy page_views_read on public.page_views for select to authenticated
  using (has_permission(auth.uid(), 'content.view', space_id));
