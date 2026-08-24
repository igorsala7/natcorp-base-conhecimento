-- =====================================================================
-- RAG: remove o trigram sobre o CONTEÚDO do chunk. Mantém o do TÍTULO.
--
-- ── O defeito ───────────────────────────────────────────────────────────
-- A busca de documentação saiu de ~1,0 s (07/08) para ~5,9 s (23/08) sem que
-- ninguém tocasse nela. A causa é de forma, não de código: o custo cresce com o
-- acervo, então a regressão chega sozinha, uma publicação por vez.
--
-- O `EXPLAIN ANALYZE` do ramo, com 10.333 chunks de ~1.339 caracteres:
--
--   Limit                                    actual time=2469.130  rows=4
--     Bitmap Heap Scan on chunks             actual time=153.075..2469.102
--       Rows Removed by Index Recheck: 8727
--       Bitmap Index Scan on chunks_content_trgm   rows=9020
--
-- O índice GIN É usado — e é quase inútil. Uma pergunta de ~43 caracteres tem
-- ~41 trigramas, e trigramas comuns do português ("com", "ara", "que") existem
-- em quase todo documento: o índice devolve 9.020 candidatos, 87% da tabela. Aí
-- o RECHECK precisa recomputar `f_unaccent(content)` e a similaridade sobre
-- documentos inteiros para descartar 8.727 deles. Sobram 4 linhas, por 2,47 s.
--
-- O mesmo ramo sobre `nodes.title` custa 2,6 ms e devolve 19 linhas — 950× mais
-- barato — porque título é curto e o índice fica realmente seletivo. Por isso
-- ele FICA: é ele que dá tolerância a erro de digitação, requisito da Fase 3.
--
-- ── Por que é seguro ────────────────────────────────────────────────────
-- Não é "o recall não caiu" (o gabarito tem 20 casos e o próprio instrumento
-- avisa que esse tamanho não conclui melhora). É mais forte: rodando a fusão COM
-- e SEM o sinal sobre os 20 casos, a posição de CADA caso ficou IDÊNTICA.
--
--   fusão                              top-1  top-4   MRR    ms/consulta
--   COM trigram de conteúdo (hoje)      3/20   8/20   0.252  2752ms
--   SEM trigram de conteúdo             3/20   8/20   0.252    83ms
--
-- Nenhuma troca de posição em nenhum caso. A medição roda o braço LÉXICO puro
-- (sem vetor, para não gravar consumo); somar o sinal vetorial só diluiria mais
-- a influência do trigram, então a conclusão vale com folga.
--
-- Instrumento: `.audit/rag-sinal-trigram.ts`.
--
-- ── Reversão ────────────────────────────────────────────────────────────
-- Para voltar, reaplique `20260805130000_hybrid_search_group_limit.sql`. O
-- índice `chunks_content_trgm` NÃO é derrubado aqui de propósito: se a decisão
-- for revista, o caminho de volta não passa por reindexar 10 mil chunks.
-- =====================================================================

create or replace function public.hybrid_search_scoped(
  p_query text,
  p_embedding vector default null::vector,
  p_node_ids uuid[] default null::uuid[],
  p_limit integer default 8,
  p_document_ids uuid[] default null::uuid[],
  p_boost text default null::text,
  p_group_limit integer default 2
)
returns table(node_id uuid, document_id uuid, title text, heading_path text,
              snippet text, content text, score double precision)
language sql
stable
set search_path to 'public', 'extensions'
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
  -- Trigram (typo): SOMENTE o título do nó (GIN nodes_title_trgm). O ramo sobre
  -- `c.content` saiu em 24/08 — 2,47 s para 4 linhas que não mudavam posição
  -- nenhuma. A estrutura aninhada continua igual à original de propósito: se o
  -- ramo de conteúdo voltar, ele volta como `union all` aqui dentro, sem
  -- reescrever o resto.
  trg as (
    select id, origem, rnk from (
      select id, origem, row_number() over (order by sim desc) as rnk
      from (
        select id, origem, max(sim) as sim
        from (
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
