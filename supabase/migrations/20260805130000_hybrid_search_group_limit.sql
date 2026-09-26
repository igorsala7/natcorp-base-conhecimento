-- =====================================================================
-- ARQUIVO SUPERADO — NÃO REAPLIQUE ESTE ARQUIVO SOZINHO
--
-- Este arquivo cria `public.hybrid_search_scoped` com 7 parâmetros. A
-- assinatura VIVA é a de 8: `20260925120000_busca_recusa_documento_de_outra_
-- base.sql` acrescentou `p_base` (a cerca de propriedade que impede um cliente
-- de receber arquivo de outro), e o CORPO atual está em
-- `20260926120000_funcoes_de_escopo_canonicas.sql` — ele saiu de
-- `20260925160000_branco_unico_e_grants.sql` na tarefa 15, quando as funções de
-- escopo ganharam sítio ÚNICO de definição.
--
-- `create or replace` com assinatura DIFERENTE não substitui nada: cria uma
-- SEGUNDA função. Com as duas de pé, `supabase.rpc("hybrid_search_scoped",
-- {...})` — que nunca nomeia todos os parâmetros — fica ambíguo e o Postgres
-- levanta `function ... is not unique`. As quatro chamadas de
-- `src/lib/ai/rag.ts` desestruturam só `{ data }`: o erro não aparece em log
-- nenhum e A BUSCA DEVOLVE VAZIO. Documentação e arquivo do cliente somem do
-- chat em silêncio, e não há nada para investigar.
--
-- NÃO acrescente `drop function` aqui para "resolver": isso deixaria de pé só
-- esta versão, SEM a cerca de base, o que é pior que a ambiguidade. Para voltar
-- ao estado correto, derrube à mão a assinatura ANTIGA que este arquivo criou e
-- reaplique `20260926120000_funcoes_de_escopo_canonicas.sql`, que é o sítio
-- único do corpo vivo e recusa um banco onde a duplicata ainda exista. Nem
-- `20260925120000` nem `20260925160000` servem mais para isso: desde a tarefa 15
-- nenhum dos dois define esta função. `npm run verificar:rpc` falha quando
-- qualquer RPC chamada por `src/` tem mais de uma assinatura, e é o portão que
-- pega esta classe.
-- =====================================================================

-- A5: teto de GRUPOS (top-N manuais/documentos) parametrizável no RAG.
--
-- A busca fundia por RRF e restringia ao top-2 grupos (raiz/doc) — anti-mistura entre
-- manuais. Numa pergunta COMPOSTA (relatório + tool + documentação) que abrange 3+ manuais,
-- o 3º nunca vinha. Agora o caller pode ampliar via `p_group_limit` (default 2 = comportamento
-- atual; 3-4 quando composta/composto). Corpo IDÊNTICO ao anterior, só o teto virou parâmetro.
-- Assinatura muda (ganha 1 arg) → precisa DROP antes do CREATE (padrão do repo).
drop function if exists public.hybrid_search_scoped(text, vector, uuid[], int, uuid[], text);

create or replace function public.hybrid_search_scoped(
  p_query text,
  p_embedding vector(1536) default null,
  p_node_ids uuid[] default null,
  p_limit int default 8,
  p_document_ids uuid[] default null,
  p_boost text default null,
  p_group_limit int default 2
) returns table (
  node_id uuid,
  document_id uuid,
  title text,
  heading_path text,
  snippet text,
  content text,
  score double precision
)
  language sql
  stable
  set search_path = public, extensions
as $$
  with q as (
    select public.f_unaccent(p_query) as uq,
           websearch_to_tsquery('portuguese', public.f_unaccent(p_query)) as tsq,
           case
             when p_boost is null or btrim(p_boost) = '' then null
             else websearch_to_tsquery('portuguese', public.f_unaccent(p_boost))
           end as bq
  ),
  -- Full-text: o GIN em `tsv` serve o `@@`; ordena/limita os casados por ts_rank.
  ft as (
    select id, origem, row_number() over (order by r desc) as rnk
    from (
      select c.id, coalesce(c.node_id, c.document_id) as origem, ts_rank(c.tsv, q.tsq) as r
      from public.chunks c, q
      where q.tsq is not null and c.tsv @@ q.tsq
        and ( (p_node_ids is null and p_document_ids is null)
              or (p_node_ids is not null and c.node_id = any (p_node_ids))
              or (p_document_ids is not null and c.document_id = any (p_document_ids)) )
      order by r desc
      limit 40
    ) s
  ),
  -- Trigram (typo): conteúdo do chunk (GIN chunks_content_trgm) ∪ título do nó
  -- (GIN nodes_title_trgm). Dedup por chunk pegando a MAIOR similaridade (= greatest).
  trg as (
    select id, origem, rnk from (
      select id, origem, row_number() over (order by sim desc) as rnk
      from (
        select id, origem, max(sim) as sim
        from (
          ( select c.id, coalesce(c.node_id, c.document_id) as origem,
                   similarity(public.f_unaccent(c.content), q.uq) as sim
            from public.chunks c, q
            where public.f_unaccent(c.content) % q.uq
              and ( (p_node_ids is null and p_document_ids is null)
                    or (p_node_ids is not null and c.node_id = any (p_node_ids))
                    or (p_document_ids is not null and c.document_id = any (p_document_ids)) )
            order by sim desc limit 40 )
          union all
          ( select c.id, coalesce(c.node_id, c.document_id) as origem,
                   similarity(public.f_unaccent(n.title), q.uq) as sim
            from public.chunks c join public.nodes n on n.id = c.node_id, q
            where public.f_unaccent(n.title) % q.uq
              and ( (p_node_ids is null and p_document_ids is null)
                    or (p_node_ids is not null and c.node_id = any (p_node_ids))
                    or (p_document_ids is not null and c.document_id = any (p_document_ids)) )
            order by sim desc limit 40 )
        ) u
        group by id, origem
      ) g
    ) r
    where rnk <= 40
  ),
  -- Vetorial: o HNSW serve `order by embedding <=> q limit 40` no acesso DIRETO.
  vec as (
    select id, origem, row_number() over (order by dist) as rnk
    from (
      select c.id, coalesce(c.node_id, c.document_id) as origem, (c.embedding <=> p_embedding) as dist
      from public.chunks c
      where p_embedding is not null and c.embedding is not null
        and ( (p_node_ids is null and p_document_ids is null)
              or (p_node_ids is not null and c.node_id = any (p_node_ids))
              or (p_document_ids is not null and c.document_id = any (p_document_ids)) )
      order by c.embedding <=> p_embedding
      limit 40
    ) s
  ),
  -- BOOST: chunks que casam os termos/sinônimos da ontologia entram como 4º sinal.
  boost as (
    select id, origem, row_number() over (order by r desc) as rnk
    from (
      select c.id, coalesce(c.node_id, c.document_id) as origem, ts_rank(c.tsv, q.bq) as r
      from public.chunks c, q
      where q.bq is not null and c.tsv @@ q.bq
        and ( (p_node_ids is null and p_document_ids is null)
              or (p_node_ids is not null and c.node_id = any (p_node_ids))
              or (p_document_ids is not null and c.document_id = any (p_document_ids)) )
      order by r desc
      limit 40
    ) s
  ),
  fused as (
    select origem, id, sum(1.0 / (60 + rnk)) as score
    from (
      select origem, id, rnk from ft
      union all select origem, id, rnk from trg
      union all select origem, id, rnk from vec
      union all select origem, id, rnk from boost
    ) u
    group by origem, id
  ),
  best as (
    select distinct on (origem) origem, id as chunk_id, score
    from fused order by origem, score desc
  ),
  agrupado as (
    select b.chunk_id, b.score,
           case
             when c2.node_id is not null
               then 'raiz:' || coalesce(subpath(n2.path, 0, 1)::text, c2.node_id::text)
             else 'doc:' || c2.document_id::text
           end as grupo
    from best b
    join public.chunks c2 on c2.id = b.chunk_id
    left join public.nodes n2 on n2.id = c2.node_id
  ),
  melhores_grupos as (
    select grupo
    from agrupado
    group by grupo
    order by sum(score) desc, max(score) desc
    limit p_group_limit
  )
  select
    c.node_id,
    c.document_id,
    coalesce(n.title, d.original_name) as title,
    c.heading_path,
    ts_headline('portuguese', c.content,
      websearch_to_tsquery('portuguese', public.f_unaccent(p_query)),
      'MaxWords=40, MinWords=15, ShortWord=2') as snippet,
    c.content, a.score
  from agrupado a
  join melhores_grupos using (grupo)
  join public.chunks c on c.id = a.chunk_id
  left join public.nodes n on n.id = c.node_id
  left join public.knowledge_documents d on d.id = c.document_id
  where c.node_id is null or n.deleted_at is null
  order by a.score desc
  limit p_limit;
$$;
