-- Ranking "mais úteis" da home pública: agregado de article_feedback.
--
-- Por que RPC e não SELECT: a leitura da tabela crua é restrita (comentários
-- de feedback não são públicos). O leitor anônimo só precisa do AGREGADO por
-- artigo — e só de artigos publicados do espaço pedido (ou do global que ele
-- herda). SECURITY DEFINER com filtro DENTRO da query, como o resto do portal.
create or replace function public.top_helpful_articles(
  p_space_id uuid,
  p_limit int default 6
)
returns table (node_id uuid, helpful bigint, total bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    f.node_id,
    count(*) filter (where f.helpful) as helpful,
    count(*) as total
  from public.article_feedback f
  join public.nodes n on n.id = f.node_id
  where n.status = 'published'
    and n.deleted_at is null
    and n.type = 'article'
    and (
      n.space_id = p_space_id
      or n.space_id = (select s.parent_space_id from public.spaces s where s.id = p_space_id)
    )
  group by f.node_id
  -- Mínimo de votos e maioria positiva: sem isso, um único 👍 lidera o ranking.
  having count(*) >= 3
     and (count(*) filter (where f.helpful))::numeric / count(*) >= 0.6
  order by (count(*) filter (where f.helpful))::numeric / count(*) desc, count(*) desc
  limit least(greatest(coalesce(p_limit, 6), 1), 12);
$$;

grant execute on function public.top_helpful_articles(uuid, int) to anon, authenticated;
