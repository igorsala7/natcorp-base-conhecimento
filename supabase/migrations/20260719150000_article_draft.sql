-- Rascunho de edição de um artigo publicado.
--
-- Em tabela SEPARADA (não numa coluna de `articles`) de propósito: assim o
-- público (role anon) não tem NENHUM acesso ao conteúdo não publicado — nem por
-- coluna, nem por RLS. O portal serve sempre `articles.content_json` (publicado);
-- as edições sobre um artigo já publicado ficam aqui até o autor Publicar
-- (commit → content_json + snapshot no histórico) ou Descartar.

create table if not exists public.article_drafts (
  node_id uuid primary key references public.nodes (id) on delete cascade,
  content_json jsonb not null,
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);

alter table public.article_drafts enable row level security;

-- Mesmo escopo dos artigos: ver com content.view, editar com content.edit.
-- NÃO há policy para anon → o público nunca lê rascunho.
create policy article_drafts_read on public.article_drafts
  for select using (
    public.has_permission(
      auth.uid(),
      'content.view',
      (select space_id from public.nodes where id = article_drafts.node_id)
    )
  );
create policy article_drafts_write on public.article_drafts
  for all using (
    public.has_permission(
      auth.uid(),
      'content.edit',
      (select space_id from public.nodes where id = article_drafts.node_id)
    )
  )
  with check (
    public.has_permission(
      auth.uid(),
      'content.edit',
      (select space_id from public.nodes where id = article_drafts.node_id)
    )
  );

-- Belt-and-suspenders: remove qualquer grant padrão ao público.
revoke all on public.article_drafts from anon;
