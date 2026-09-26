-- =====================================================================
-- ARQUIVO SUPERADO — NÃO REAPLIQUE ESTE ARQUIVO SOZINHO
--
-- Este arquivo cria `public.knowledge_list_chunks` com 3 parâmetros. A
-- assinatura VIVA é a de 4: `20260925120000_busca_recusa_documento_de_outra_
-- base.sql` acrescentou `p_base` (a cerca de propriedade que impede um cliente
-- de receber arquivo de outro), e o CORPO atual está em
-- `20260925160000_branco_unico_e_grants.sql`.
--
-- `create or replace` com assinatura DIFERENTE não substitui nada: cria uma
-- SEGUNDA função. Com as duas de pé, `supabase.rpc("knowledge_list_chunks",
-- {...})` — que nunca nomeia todos os parâmetros — fica ambíguo e o Postgres
-- levanta `function ... is not unique`. A chamada em `src/lib/ai/rag.ts`
-- desestrutura só `{ data }`: o erro não aparece em log nenhum e A ENUMERAÇÃO
-- DEVOLVE VAZIO — e esta é a função do caminho "todos os X de Y", a que mais
-- conteúdo entrega ao prompt.
--
-- NÃO acrescente `drop function` aqui para "resolver": isso deixaria de pé só
-- esta versão, SEM a cerca de base, o que é pior que a ambiguidade. Para voltar
-- ao estado correto, reaplique `20260925120000` e depois `20260925160000`,
-- nessa ordem. `npm run verificar:rpc` falha quando qualquer RPC chamada por
-- `src/` tem mais de uma assinatura, e é o portão que pega esta classe.
-- =====================================================================

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
