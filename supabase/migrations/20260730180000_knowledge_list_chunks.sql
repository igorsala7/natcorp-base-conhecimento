-- Enumeração sobre ARQUIVOS DE CONHECIMENTO: dado um conjunto de documentos,
-- traz TODOS os chunks que casam a consulta (léxico, ordenado por relevância) —
-- não só o "melhor". O hybrid_search_scoped colapsa 1 chunk por documento
-- (distinct on origem), o que impede responder "quais são TODOS os programas do
-- módulo X" quando a lista está espalhada em vários chunks. Usa o mesmo tsv
-- unaccent do restante da busca. SECURITY INVOKER (a RLS de chunks vale para o
-- chamador; o widget usa service-role e o admin lê tudo).
create or replace function public.knowledge_list_chunks(
  p_query text,
  p_document_ids uuid[],
  p_limit int default 40
)
returns table (
  document_id uuid,
  title text,
  heading_path text,
  content text,
  score double precision
)
  language sql
  stable
  set search_path = public, extensions
as $$
  select c.document_id,
         d.original_name as title,
         c.heading_path,
         c.content,
         ts_rank(c.tsv, websearch_to_tsquery('portuguese', public.f_unaccent(p_query)))::double precision as score
  from public.chunks c
  join public.knowledge_documents d on d.id = c.document_id
  where c.document_id = any (p_document_ids)
    and c.tsv @@ websearch_to_tsquery('portuguese', public.f_unaccent(p_query))
  order by score desc
  limit greatest(1, least(p_limit, 100));
$$;
