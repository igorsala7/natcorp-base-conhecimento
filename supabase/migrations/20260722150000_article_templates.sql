-- Modelos de artigo salvos pelo time ("Salvar como modelo" no editor), além
-- dos 3 embutidos no código (FAQ, passo a passo, troubleshooting).
create table public.article_templates (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  name text not null,
  description text,
  blocks jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
create index article_templates_space_idx on public.article_templates (space_id);

alter table public.article_templates enable row level security;

create policy article_templates_read on public.article_templates
  for select to authenticated
  using (public.has_permission(auth.uid(), 'content.view', space_id));
create policy article_templates_write on public.article_templates
  for all to authenticated
  using (public.has_permission(auth.uid(), 'content.edit', space_id))
  with check (public.has_permission(auth.uid(), 'content.edit', space_id));
