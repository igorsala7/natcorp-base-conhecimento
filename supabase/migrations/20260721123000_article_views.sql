-- Visualizações por artigo, agregadas por dia.
--
-- Contador diário (node_id, day) em vez de uma linha por visita: o que as
-- análises precisam é "mais vistos / sem visita", não trilha por visitante —
-- e a tabela não cresce sem teto. Sem cookie, sem fingerprint; a deduplicação
-- por sessão fica no navegador (sessionStorage) e o rate limit no servidor.
create table public.article_views (
  node_id uuid not null references public.nodes (id) on delete cascade,
  day date not null default (now() at time zone 'utc')::date,
  views int not null default 0,
  primary key (node_id, day)
);
alter table public.article_views enable row level security;

-- Ninguém escreve direto (nem anon, nem autenticado): só a RPC abaixo.
-- Leitura é do admin com permissão de conteúdo, como o feedback.
create policy views_read on public.article_views
  for select to authenticated using (
    exists (
      select 1 from public.nodes n
      where n.id = article_views.node_id
        and public.has_permission(auth.uid(), 'content.view', n.space_id)
    )
  );

-- Incremento com validação DENTRO da função: só conta artigo publicado de
-- espaço alcançável pelo portal (público ou com senha). O mesmo espírito da
-- policy de article_feedback.
create or replace function public.register_article_view(p_node_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.article_views as av (node_id, day, views)
  select p_node_id, (now() at time zone 'utc')::date, 1
  where exists (
    select 1 from public.nodes n
    join public.spaces s on s.id = n.space_id
    where n.id = p_node_id
      and n.type = 'article'
      and n.status = 'published'
      and n.deleted_at is null
      and s.visibility in ('public', 'password')
  )
  on conflict (node_id, day) do update set views = av.views + 1;
$$;

grant execute on function public.register_article_view(uuid) to anon, authenticated;
