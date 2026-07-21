-- "Artigos relacionados" no fim da página de leitura.
--
-- Similaridade vetorial usando os embeddings que JÁ existem em `chunks` — zero
-- chamadas de IA em runtime. O alvo é o centroide (média) dos embeddings dos
-- artigos da página; candidatos são os demais artigos publicados do espaço
-- (ou do global que ele herda), ranqueados pelo chunk mais próximo.
--
-- Segurança: SECURITY DEFINER com o filtro de espaço DENTRO da query — um
-- leitor do cliente A não recebe candidato do cliente B (regra de ouro).
-- A página ainda cruza o resultado com a árvore efetiva dela (overlays).
create or replace function public.related_articles(
  p_node_ids uuid[],
  p_space_id uuid,
  p_limit int default 4
)
returns table (node_id uuid, score double precision)
language sql
stable
security definer
-- `extensions` no path: é onde o Supabase instala o pgvector (avg e <=>).
set search_path = public, extensions
as $$
  with alvo as (
    select avg(embedding) as emb
    from public.chunks
    where node_id = any(p_node_ids)
      and embedding is not null
  )
  select
    c.node_id,
    max(1 - (c.embedding <=> a.emb))::double precision as score
  from public.chunks c
  join alvo a on a.emb is not null
  join public.nodes n on n.id = c.node_id
  where c.embedding is not null
    and not (c.node_id = any(p_node_ids))
    and (
      c.space_id = p_space_id
      or c.space_id = (select s.parent_space_id from public.spaces s where s.id = p_space_id)
    )
    and n.status = 'published'
    and n.deleted_at is null
    and n.type = 'article'
  group by c.node_id
  order by score desc
  limit least(greatest(coalesce(p_limit, 4), 1), 12);
$$;

grant execute on function public.related_articles(uuid[], uuid, int) to anon, authenticated;
