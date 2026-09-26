-- =====================================================================
-- SÍTIO ÚNICO DE DEFINIÇÃO DAS FUNÇÕES DE ESCOPO POR BASE
--
-- ESTE arquivo é o único sítio de definição de cinco funções:
--
--   · public.bases_do_codigo(text)
--   · public.escopo_documentacao(text, jsonb)
--   · public.documentos_da_base(text, jsonb)
--   · public.hybrid_search_scoped(text, vector, uuid[], integer, uuid[], text,
--                                 integer, text)
--   · public.knowledge_list_chunks(text, uuid[], integer, text)
--
-- Editar qualquer uma delas em OUTRO arquivo é o defeito que esta migration
-- fechou. `npm run verificar:corpo` recusa o segundo sítio.
--
-- ── O defeito que isto encerra ────────────────────────────────────────
-- Não há ledger de migrations, então reaplicar um arquivo à mão é operação
-- NORMAL aqui. Com a mesma função definida em dois arquivos, reaplicar o mais
-- antigo desfaz o mais novo em SILÊNCIO — a assinatura continua única, então
-- nem `npm run verificar:rpc` nem a assertiva de assinatura de 20260925120000
-- percebem: é o CORPO que retrocede.
--
-- Antes desta migration, reaplicar sozinho:
--
--   · `20260925110000` devolvia `documentos_da_base` sem `status = 'ready'`,
--     e o RAG voltava a servir arquivo em extração (chunks pela metade
--     afirmados como o todo);
--   · `20260925120000` devolvia `public.ai_bases` para a range table das duas
--     funções de busca, que são SECURITY INVOKER — a busca pública do portal
--     morria com `permission denied for table ai_bases` e a action engolia o
--     erro como lista vazia (ficou morta por horas em 25/09). O mesmo arquivo
--     devolvia o `btrim` de UM argumento, reabrindo o furo do NBSP ENTRE
--     CLIENTES: uma base que difere só por NBSP é linha distinta para o índice
--     único e o MESMO valor para o motor de elegibilidade;
--   · `20260925140000` devolvia o mesmo `btrim` de um argumento em
--     `escopo_documentacao` e o EXECUTE de `authenticated` nela;
--   · `20260925160000` desfazia o `status = 'ready'` de `documentos_da_base`.
--
-- ── O método, que é o que faz disto um no-op VERIFICADO ───────────────
-- Os corpos abaixo NÃO foram remontados mesclando os arquivos antigos à mão:
-- são a saída de `pg_get_functiondef` do banco de PRODUÇÃO colada aqui, que é
-- o corpo que passou por todas as correções e todas as medições. Daí o
-- cabeçalho em MAIÚSCULAS e a forma `DEFAULT NULL::vector`: é o texto que o
-- banco devolve, não o que um arquivo antigo dizia.
--
-- O SHA-256 de `pg_get_functiondef` das seis funções (as cinco acima mais
-- `public.codigo_normalizado`) foi capturado ANTES de escrever este arquivo e
-- conferido DEPOIS de aplicá-lo: os seis digestos têm de ser IDÊNTICOS. É isso
-- que transforma um refactor arriscado em transposição verificada. Os digestos
-- estão no relatório da tarefa 15.
--
-- ── Por que `codigo_normalizado` NÃO está aqui ────────────────────────
-- O plano original mandava trazer `public.codigo_normalizado(text)` junto com
-- `bases_do_codigo`. Ela FICOU em `20260925160000`, que é o seu único sítio, por
-- uma dependência de ORDEM que não tem saída dentro deste arquivo: aquela mesma
-- migration cria o índice único `ai_bases_codigo_normalizado_key` SOBRE a
-- expressão `public.codigo_normalizado(base_code)` e o CHECK
-- `ai_bases_codigo_nao_branco` sobre a mesma chamada. Trazer a função para um
-- arquivo POSTERIOR faria uma aplicação do zero de `20260925160000` falhar com
-- `function public.codigo_normalizado(text) does not exist` — trocaríamos um
-- defeito silencioso por um erro duro na replay.
--
-- Ela não era parte do problema: tem UM sítio de definição, e reaplicar
-- `20260925160000` sozinho a recria idêntica. As quatro funções deste arquivo a
-- chamam em tempo de execução, e `20260925160000` roda antes na sequência.
--
-- ── De onde veio cada bloco ──────────────────────────────────────────
-- Definições e privilégios:
--   `bases_do_codigo`, `hybrid_search_scoped`, `knowledge_list_chunks`,
--   `escopo_documentacao` ....... de 20260925160000
--   `documentos_da_base` ........ de 20260926100000
--
-- Assertivas (vieram JUNTO com as definições, de propósito: elas CHAMAM as
-- funções, e numa aplicação do zero rodariam antes de a função existir se
-- ficassem nos arquivos antigos):
--   cerca entre bases + assinatura única ......... de 20260925120000
--   sobreposição por base (seis casos) ........... de 20260925140000
--   NBSP no p_base, `anon` chama a busca, grants .. de 20260925160000
--   `status = 'ready'` ........................... de 20260926100000
--
-- Os cinco arquivos antigos ficaram com o que é deles — tabelas, colunas,
-- políticas, índices, CHECKs — e com as assertivas que não chamam função
-- nenhuma. Cada um diz no cabeçalho o que saiu e para onde foi.
--
-- ── `create or replace`, e `drop function` PROIBIDO aqui ─────────────
-- Nenhuma assinatura muda. `drop function` + `create` devolveria EXECUTE a
-- PUBLIC (portanto a `anon`) e desfaria os revokes que este ramo passou uma
-- rodada fechando. Os privilégios são restatados abaixo de propósito: o
-- `replace` preserva o ACL, mas o arquivo tem de ser auto-suficiente e
-- re-rodável, porque não há ledger.
-- =====================================================================

-- =====================================================================
-- 1/5 — public.bases_do_codigo(text)
--
-- Existe como SECURITY DEFINER para tirar `public.ai_bases` da range table das
-- duas funções de busca, que são SECURITY INVOKER e são chamadas por `anon`: a
-- permissão de tabela é conferida no INÍCIO da execução, para toda entrada da
-- range table, então bastava a tabela estar no plano para a busca do portal
-- receber `permission denied` e devolver vazio em silêncio. Chamada de função
-- não é entrada de range table.
--
-- Vem PRIMEIRO neste arquivo porque a ordem dentro de um arquivo é a de
-- execução, e `language sql` valida o corpo no CREATE: as duas funções de busca
-- não são criáveis antes dela existir.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.bases_do_codigo(p_base text)
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
  select b.id
    from public.ai_bases b
   where p_base is not null
     and public.codigo_normalizado(b.base_code) = public.codigo_normalizado(p_base);
$function$;

comment on function public.bases_do_codigo(text) is
  'Ids das bases cujo base_code normalizado bate com p_base. PODE devolver zero, uma ou várias linhas (nunca é consumida como subconsulta escalar). Existe como security definer para que hybrid_search_scoped e knowledge_list_chunks, que são security invoker e são chamadas por `anon`, não tenham public.ai_bases na range table: a permissão de tabela é conferida no início da execução, então bastava a tabela estar no plano para `anon` receber permission denied e a busca do portal devolver vazio em silêncio.';

revoke all on function public.bases_do_codigo(text) from public;
-- `anon` explicitamente, e com o motivo escrito: a busca do portal roda como
-- `anon`, sem sessão (`src/app/(portal)/actions.ts:141`). Sem este grant, a
-- restrição global "função nova: revoke de public, anon" reproduz exatamente o
-- incidente que 20260721140000_search_anon_knowledge_grant.sql documenta.
grant execute on function public.bases_do_codigo(text) to anon, authenticated, service_role;

-- =====================================================================
-- 2/5 — public.escopo_documentacao(text, jsonb)
--
-- A linha de `ai_base_documentacoes` é SOBREPOSIÇÃO sobre a universal e só
-- ESTREITA (interseção das duas regras, nunca substituição — a regra da Natcorp
-- é teto). O raciocínio completo de cada ramo está em 20260925140000, que
-- continua sendo o arquivo da DECISÃO; aqui mora a definição.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.escopo_documentacao(p_base text, p_identidade jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(space_id uuid, origem text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
  with alvo as (
    select b.id
      from public.ai_bases b
     where public.codigo_normalizado(b.base_code) = public.codigo_normalizado(p_base)
  )
  -- Ramo 1: as universais, JÁ com a sobreposição desta base aplicada.
  -- `left join` com a base no ON (e não no WHERE): sem linha da base, o lado
  -- direito vem nulo e a universal vale como está. Base desconhecida deixa
  -- `alvo` vazio, nenhuma linha casa, e o resultado é só as universais — o
  -- comportamento documentado desde 20260925100000.
  --
  -- `codigo_normalizado(p_base)` sem `coalesce`: nulo entra, nulo sai, e nulo
  -- não casa com nada. Antes era `lower(btrim(coalesce(p_base,'')))`, que com
  -- `p_base` nulo comparava contra vazio e casaria um `base_code` em branco —
  -- que o CHECK desta migration passou a proibir, mas depender do CHECK para a
  -- comparação estar certa é depender de duas coisas onde uma bastava.
  select u.space_id, 'universal'::text
    from public.documentacoes_universais u
    left join public.ai_base_documentacoes d
      on d.space_id = u.space_id
     and d.base_id in (select id from alvo)
   where u.enabled
     and public.elegivel(u.regra, p_identidade)
     and (
       -- sem sobreposição: vale a universal
       d.space_id is null
       -- com sobreposição habilitada: INTERSEÇÃO das duas regras
       or (d.enabled and public.elegivel(d.regra, p_identidade))
     )
  union
  -- Ramo 2: anexo por base que NÃO é universal. O `not exists` evita contar
  -- a mesma documentação duas vezes (uma por origem) e deixa explícito que
  -- este ramo é só para o que a Natcorp não ofereceu a todos.
  select d.space_id, 'base'::text
    from public.ai_base_documentacoes d
   where d.base_id in (select id from alvo)
     and d.enabled
     and public.elegivel(d.regra, p_identidade)
     and not exists (
       select 1 from public.documentacoes_universais u2 where u2.space_id = d.space_id
     );
$function$;

comment on function public.escopo_documentacao(text, jsonb) is
  'Documentações que esta identidade alcança nesta base. A linha de ai_base_documentacoes é SOBREPOSIÇÃO sobre a universal e só ESTREITA: sem linha vale a universal; enabled=false esconde; enabled=true exige as DUAS regras (interseção, nunca substituição — a regra da Natcorp é teto). Enquanto existir linha universal ela é o teto, inclusive desligada: para devolver a documentação ao controle por base, APAGUE a linha universal. O segundo ramo devolve só anexo por base que não é universal. Base desconhecida devolve só as universais. O base_code é comparado por public.codigo_normalizado (mesmo aparo de allowlist_casa). Escopo da chave do widget NÃO passa por aqui: ele é somado pela aplicação (decidirEscopo) e se retira em /admin/widget.';

-- `authenticated` FORA: sendo security definer ela ignora a RLS das quatro
-- tabelas que lê, e o único chamador é `service_role`
-- (`src/lib/ai/escopo-da-base.ts`, via `createAdminClient`). Com EXECUTE para
-- `authenticated`, qualquer Leitor deduzia a regra do dono variando a
-- identidade.
revoke all on function public.escopo_documentacao(text, jsonb) from public, anon, authenticated;
grant execute on function public.escopo_documentacao(text, jsonb) to service_role;

-- =====================================================================
-- 3/5 — public.documentos_da_base(text, jsonb)
--
-- Só arquivo DE BASE, e só o que está `ready`: arquivo em extração tem chunks
-- pela metade, e o modelo afirma o parcial como se fosse o todo. O porquê de o
-- predicado morar no SQL e não na aplicação está em 20260926100000.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.documentos_da_base(p_base text, p_identidade jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(document_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
  select k.id
    from public.knowledge_documents k
    join public.ai_bases b on b.id = k.base_id
   where k.base_id is not null
     -- Só o que está PRONTO: arquivo em extração tem chunks pela metade, e
     -- meia planilha afirmada como inteira é pior do que nenhuma resposta.
     and k.status = 'ready'
     and public.codigo_normalizado(b.base_code) = public.codigo_normalizado(p_base)
     and public.elegivel(k.regra, p_identidade);
$function$;

comment on function public.documentos_da_base(text, jsonb) is
  'Arquivos DE CLIENTE, PRONTOS (status = ready), que esta identidade alcança nesta base, filtrados por public.elegivel. O filtro de status é o mesmo que rag.ts já aplicava aos arquivos dos ESPAÇOS, e mora aqui porque é aqui que o escopo por base mora: arquivo em extração tem chunks pela metade e o modelo afirmaria o parcial como se fosse o todo. A tela de administração lista da tabela, não desta função, e continua mostrando queued/extracting/error. Nunca devolve arquivo de outra base: o join por base_code normalizado (public.codigo_normalizado) é a cerca, e o teste de isolamento em .audit/ é o que a prova. EXECUTE só para service_role: sendo security definer ela ignora a RLS, e com grant a authenticated qualquer Leitor enumerava os ids dos arquivos internos de qualquer cliente.';

revoke all on function public.documentos_da_base(text, jsonb) from public, anon, authenticated;
grant execute on function public.documentos_da_base(text, jsonb) to service_role;

-- =====================================================================
-- 4/5 — public.hybrid_search_scoped(...)
--
-- Busca híbrida (RRF: full-text + trigram + vetor + boost) escopada por
-- nós/documentos, com a cerca de PROPRIEDADE por base no CTE `agrupado`. O
-- raciocínio de cada sinal, da cerca e do que ela NÃO cobre está em
-- 20260925120000; a resolução da base por `bases_do_codigo` e o incidente do
-- `anon` estão em 20260925160000.
--
-- `p_base` nulo preserva TODOS os chamadores sem base (portal, Cmd+K, editor).
-- =====================================================================
CREATE OR REPLACE FUNCTION public.hybrid_search_scoped(p_query text, p_embedding vector DEFAULT NULL::vector, p_node_ids uuid[] DEFAULT NULL::uuid[], p_limit integer DEFAULT 8, p_document_ids uuid[] DEFAULT NULL::uuid[], p_boost text DEFAULT NULL::text, p_group_limit integer DEFAULT 2, p_base text DEFAULT NULL::text)
 RETURNS TABLE(node_id uuid, document_id uuid, title text, heading_path text, snippet text, content text, score double precision)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions'
AS $function$
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
  -- Base(s) alvo desta busca, resolvida(s) UMA vez.
  --
  -- `public.bases_do_codigo` e não `from public.ai_bases`: esta função é
  -- `security invoker` e a busca do portal a chama como `anon`, que não tem
  -- grant em `ai_bases`. A permissão de tabela é conferida no INÍCIO da
  -- execução, para toda entrada da range table, então a tabela no plano
  -- bastava para `anon` receber `permission denied for table ai_bases` mesmo
  -- com `p_base` nulo — e a action engolia o erro como lista vazia. Chamada de
  -- função não é entrada de range table.
  --
  -- `materialized`: a CTE é consumida dentro de um `not exists` correlacionado,
  -- e sem isso o planejador pode chamar a função por linha de `agrupado`.
  --
  -- Vazio quando `p_base` é nulo OU não bate com nenhuma base cadastrada — os
  -- dois casos fecham a cerca. PODE devolver mais de uma linha, e por isso o
  -- consumo abaixo é `not exists` de pertinência, nunca subconsulta escalar.
  base_alvo as materialized (
    select t.id from public.bases_do_codigo(p_base) as t(id)
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
    -- A CERCA: chunk de artigo (document_id nulo) e chunk de documento de
    -- ESPAÇO (base_id nulo) sempre passam. Chunk de documento de BASE só
    -- passa se a base bater com `p_base` — e "bater" inclui `p_base`
    -- nulo, que é o caso de todo chamador sem base (portal, Cmd+K).
    where p_base is null
       or not exists (
            select 1
              from public.knowledge_documents d
             where d.id = c2.document_id
               and d.base_id is not null
               and not exists (select 1 from base_alvo ba where ba.id = d.base_id)
          )
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
$function$;

comment on function public.hybrid_search_scoped(text, vector, uuid[], integer, uuid[], text, integer, text) is
  'Busca híbrida (RRF: full-text + trigram + vetor + boost) escopada por nós/documentos. `p_base` é cerca de PROPRIEDADE (knowledge_documents.base_id), nunca de elegibilidade — nulo preserva todo chamador sem base. A base alvo é resolvida por public.bases_do_codigo (security definer) para que public.ai_bases não entre na range table desta função, que é security invoker e é chamada como `anon` pela busca do portal.';

-- EXECUTE segue ABERTO a PUBLIC/`anon`, porque a busca do portal roda sem
-- sessão. Sendo `security invoker`, a leitura de `chunks` continua governada
-- pela RLS de quem chama. NÃO revogar aqui: reproduz o incidente de
-- 20260721140000_search_anon_knowledge_grant.sql — a busca do portal morre com
-- "permission denied" e a action engole o erro como lista vazia.
grant execute on function public.hybrid_search_scoped(text, vector, uuid[], integer, uuid[], text, integer, text) to public;

-- =====================================================================
-- 5/5 — public.knowledge_list_chunks(...)
--
-- O caminho de ENUMERAÇÃO ("todos os X de Y"), que devolve até 40 chunks por
-- documento em vez de 1 — o pior lugar para deixar sem cerca, porque é o que
-- mais despeja conteúdo no prompt. MESMA cerca de `hybrid_search_scoped`, mesmo
-- texto de propósito (revisão mais fácil).
-- =====================================================================
CREATE OR REPLACE FUNCTION public.knowledge_list_chunks(p_query text, p_document_ids uuid[], p_limit integer DEFAULT 40, p_base text DEFAULT NULL::text)
 RETURNS TABLE(document_id uuid, title text, heading_path text, content text, score double precision)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions'
AS $function$
  -- MESMA resolução de base de hybrid_search_scoped, e pelo mesmo motivo:
  -- `security invoker` chamada por `anon`, que não tem grant em `ai_bases`.
  with base_alvo as materialized (
    select t.id from public.bases_do_codigo(p_base) as t(id)
  )
  select c.document_id,
         d.original_name as title,
         c.heading_path,
         c.content,
         ts_rank(c.tsv, websearch_to_tsquery('portuguese', public.f_unaccent(p_query)))::double precision as score
  from public.chunks c
  join public.knowledge_documents d on d.id = c.document_id
  where c.document_id = any (p_document_ids)
    and c.tsv @@ websearch_to_tsquery('portuguese', public.f_unaccent(p_query))
    -- MESMA cerca de hybrid_search_scoped, mesmo texto de propósito
    -- (revisão mais fácil): document_id sem base (documentação de espaço)
    -- sempre passa; com base, só passa se bater com `p_base`. `not exists`
    -- de pertinência (não subconsulta escalar) porque `base_alvo` pode
    -- devolver mais de uma linha.
    and (
      p_base is null
      or not exists (
           select 1
             from public.knowledge_documents d2
            where d2.id = c.document_id
              and d2.base_id is not null
              and not exists (select 1 from base_alvo ba where ba.id = d2.base_id)
         )
    )
  order by score desc
  limit greatest(1, least(p_limit, 100));
$function$;

comment on function public.knowledge_list_chunks(text, uuid[], integer, text) is
  'Enumeração: todos os chunks (até 40) dos documentos que casam a consulta. `p_base` é a MESMA cerca de propriedade de hybrid_search_scoped — nulo preserva todo chamador sem base. A base alvo vem de public.bases_do_codigo pelo mesmo motivo de lá: esta função é security invoker e `anon` não tem grant em public.ai_bases.';

grant execute on function public.knowledge_list_chunks(text, uuid[], integer, text) to public;

-- =====================================================================
-- ASSERTIVA A — A CERCA ENTRE BASES (veio de 20260925120000)
--
-- Comportamental, não de substring. Cria duas bases e um documento de BASE em
-- cada, com o MESMO token no conteúdo dos dois (para os dois competirem pela
-- mesma busca), roda as duas funções com `p_base` nulo, com `p_base` de uma base
-- que EXISTE e com `p_base` de uma base que NÃO existe (o caso que distingue
-- "fecha" de "abre em silêncio"), e limpa tudo antes do fim do bloco — se
-- qualquer `assert` falhar, a exceção aborta a transação inteira do arquivo e o
-- `migrate:apply` reverte junto (nenhuma linha de teste sobrevive nos dois
-- caminhos).
-- =====================================================================
do $cerca$
declare
  v_base_a   uuid;
  v_base_b   uuid;
  v_doc_a    uuid;
  v_doc_b    uuid;
  v_hss_sem  int;
  v_hss_com  int;
  v_hss_tem_b boolean;
  v_klc_sem  int;
  v_klc_com  int;
  v_klc_tem_b boolean;
  v_hss_base_inexistente int;
  v_klc_base_inexistente int;
begin
  -- Limpeza defensiva: se uma aplicação anterior deste arquivo foi
  -- interrompida de um jeito que Postgres não devia permitir (a
  -- transação é atômica), isto garante que o insert abaixo não esbarra
  -- em `base_code` duplicado.
  delete from public.ai_bases where base_code like 'zz-tarefa7-assert-%';

  insert into public.ai_bases (base_code, name)
    values ('zz-tarefa7-assert-base-a', 'zz-tarefa7-assert-base-a')
    returning id into v_base_a;
  insert into public.ai_bases (base_code, name)
    values ('zz-tarefa7-assert-base-b', 'zz-tarefa7-assert-base-b')
    returning id into v_base_b;

  insert into public.knowledge_documents (base_id, storage_path, original_name, status)
    values (v_base_a, 'zz-tarefa7-assert/a.txt', 'zz-tarefa7-assert-doc-a.txt', 'ready')
    returning id into v_doc_a;
  insert into public.knowledge_documents (base_id, storage_path, original_name, status)
    values (v_base_b, 'zz-tarefa7-assert/b.txt', 'zz-tarefa7-assert-doc-b.txt', 'ready')
    returning id into v_doc_b;

  -- Mesmo token nos dois ('zzmarcadortarefa7' + 'pertence'), para uma
  -- consulta casar os DOIS documentos igualmente sem a cerca. `tsv` é
  -- coluna GERADA (generated always as to_tsvector(...) stored) — não
  -- entra no insert, o Postgres a preenche sozinho a partir de `content`.
  insert into public.chunks (document_id, content)
    values (
      v_doc_a,
      'Documento de teste zzmarcadortarefa7 pertence exclusivamente a base zz-tarefa7-assert-base-a.'
    );
  insert into public.chunks (document_id, content)
    values (
      v_doc_b,
      'Documento de teste zzmarcadortarefa7 pertence exclusivamente a base zz-tarefa7-assert-base-b.'
    );

  -- ── hybrid_search_scoped ────────────────────────────────────────────
  select count(*) into v_hss_sem
    from public.hybrid_search_scoped(
      p_query := 'zzmarcadortarefa7',
      p_document_ids := array[v_doc_a, v_doc_b],
      p_limit := 10,
      p_group_limit := 10
    );

  select count(*), bool_or(document_id = v_doc_b) into v_hss_com, v_hss_tem_b
    from public.hybrid_search_scoped(
      p_query := 'zzmarcadortarefa7',
      p_document_ids := array[v_doc_a, v_doc_b],
      p_limit := 10,
      p_group_limit := 10,
      p_base := 'zz-tarefa7-assert-base-a'
    );

  assert v_hss_sem = 2,
    format('hybrid_search_scoped sem p_base: esperava 2 linhas (comportamento inalterado), veio %s', v_hss_sem);
  assert v_hss_com = 1,
    format('hybrid_search_scoped com p_base da base A: esperava 1 linha (só o documento da base A), veio %s', v_hss_com);
  assert coalesce(v_hss_tem_b, false) = false,
    'hybrid_search_scoped com p_base da base A: o documento da base B NÃO pode aparecer, mesmo em p_document_ids';

  -- ── knowledge_list_chunks ───────────────────────────────────────────
  select count(*) into v_klc_sem
    from public.knowledge_list_chunks(
      p_query := 'zzmarcadortarefa7 pertence',
      p_document_ids := array[v_doc_a, v_doc_b],
      p_limit := 40
    );

  select count(*), bool_or(document_id = v_doc_b) into v_klc_com, v_klc_tem_b
    from public.knowledge_list_chunks(
      p_query := 'zzmarcadortarefa7 pertence',
      p_document_ids := array[v_doc_a, v_doc_b],
      p_limit := 40,
      p_base := 'zz-tarefa7-assert-base-a'
    );

  assert v_klc_sem = 2,
    format('knowledge_list_chunks sem p_base: esperava 2 linhas (comportamento inalterado), veio %s', v_klc_sem);
  assert v_klc_com = 1,
    format('knowledge_list_chunks com p_base da base A: esperava 1 linha (só o documento da base A), veio %s', v_klc_com);
  assert coalesce(v_klc_tem_b, false) = false,
    'knowledge_list_chunks com p_base da base A: o documento da base B NÃO pode aparecer, mesmo em p_document_ids';

  -- ── p_base que NÃO existe em ai_bases ───────────────────────────────
  -- Com `p_base` de uma base que EXISTE, o operador escalar antigo e o
  -- `not exists` novo se comportam IGUAL — nenhuma assertiva acima
  -- distingue "fecha" de "abre em silêncio" no caminho em que `base_alvo`
  -- fica vazio por não achar NENHUMA base (não só por achar a base
  -- ERRADA). `base_alvo` vazio tem de recusar TODOS os documentos de
  -- base, dos dois arquivos, não deixar nenhum passar.
  select count(*) into v_hss_base_inexistente
    from public.hybrid_search_scoped(
      p_query := 'zzmarcadortarefa7',
      p_document_ids := array[v_doc_a, v_doc_b],
      p_limit := 10,
      p_group_limit := 10,
      p_base := 'zz-base-que-nao-existe'
    );
  assert v_hss_base_inexistente = 0,
    format('hybrid_search_scoped com p_base inexistente: esperava 0 linhas (ausência fecha), veio %s', v_hss_base_inexistente);

  select count(*) into v_klc_base_inexistente
    from public.knowledge_list_chunks(
      p_query := 'zzmarcadortarefa7 pertence',
      p_document_ids := array[v_doc_a, v_doc_b],
      p_limit := 40,
      p_base := 'zz-base-que-nao-existe'
    );
  assert v_klc_base_inexistente = 0,
    format('knowledge_list_chunks com p_base inexistente: esperava 0 linhas (ausência fecha), veio %s', v_klc_base_inexistente);

  -- Limpeza final. `ai_bases` cascateia para `knowledge_documents` e daí
  -- para `chunks` (as três FKs são ON DELETE CASCADE) — um delete só.
  delete from public.ai_bases where base_code like 'zz-tarefa7-assert-%';
end $cerca$;

-- =====================================================================
-- ASSERTIVA B — ASSINATURA ÚNICA (veio de 20260925120000)
--
-- Oito migrations anteriores criam `hybrid_search_scoped` com 4, 5, 6 ou 7
-- parâmetros, e uma cria `knowledge_list_chunks` com 3. Todas usam `create or
-- replace`, e nenhuma derruba a assinatura ATUAL. Reaplicar qualquer uma delas à
-- mão deixa DUAS funções do mesmo nome de pé, e a partir daí toda chamada do app
-- — `supabase.rpc(nome, {...})`, que não nomeia todos os parâmetros — levanta
-- `function ... is not unique`. As cinco chamadas de `src/lib/ai/rag.ts` e de
-- `src/app/(portal)/actions.ts` desestruturam só `{ data }`: o erro não aparece
-- em log nenhum e a BUSCA DEVOLVE VAZIO.
--
-- Os oito arquivos têm cabeçalho de `ARQUIVO SUPERADO` desde a tarefa 12. Isto
-- aqui é a rede de baixo: toda vez que ESTE arquivo for aplicado, ele recusa um
-- banco onde a duplicata já existe. E `npm run verificar:rpc` faz a mesma
-- checagem para TODAS as RPCs que `src/` chama, sem depender de aplicar
-- migration nenhuma.
--
-- `count(*) = 1` e não `>= 1` de propósito: zero também é defeito (função que o
-- app chama e não existe devolve o mesmo vazio silencioso).
-- =====================================================================
do $assinatura$
declare
  v_hss int;
  v_klc int;
begin
  select count(*) into v_hss
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'hybrid_search_scoped';

  select count(*) into v_klc
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'knowledge_list_chunks';

  assert v_hss = 1,
    format('public.hybrid_search_scoped tem de ter UMA assinatura, e tem %s. Alguma migration antiga foi reaplicada: toda chamada do app fica ambigua (function ... is not unique) e a busca devolve VAZIO em silencio. Veja o cabecalho dos oito arquivos superados.', v_hss);

  assert v_klc = 1,
    format('public.knowledge_list_chunks tem de ter UMA assinatura, e tem %s. Mesmo defeito, no caminho de ENUMERACAO (todos os X de Y).', v_klc);
end $assinatura$;

-- =====================================================================
-- ASSERTIVA C — SOBREPOSIÇÃO POR BASE, SEIS CASOS (veio de 20260925140000)
--
-- Seis espaços de teste, um por comportamento:
--   u1 → universal aberta, SEM sobreposição            (assertiva 1)
--   u2 → universal aberta, sobreposição enabled=false  (assertiva 2)
--   u3 → universal aberta, sobreposição com regra PG   (assertiva 3)
--   u4 → universal restrita a PG, sobreposição ABERTA  (assertiva 4)
--   b1 → NÃO universal, anexada à base A               (assertiva 5)
--   u5 → universal DESLIGADA, sobreposição habilitada  (assertiva 6)
--
-- Não há `rollback` dentro de um bloco anônimo (o comando não existe em
-- PL/pgSQL); o que garante que nada sobrevive a uma falha é
-- `scripts/apply-migrations.ts`, que envolve o arquivo inteiro em begin/commit.
-- =====================================================================
do $sobreposicao$
declare
  v_base_a uuid;
  v_base_b uuid;
  v_sp_u1  uuid;
  v_sp_u2  uuid;
  v_sp_u3  uuid;
  v_sp_u4  uuid;
  v_sp_u5  uuid;
  v_sp_b1  uuid;
  v_cod_a  text  := 'zz-tarefa9-assert-base-a';
  v_cod_b  text  := 'zz-tarefa9-assert-base-b';
  v_pg     jsonb := '{"portal":"PG"}'::jsonb;
  v_po     jsonb := '{"portal":"PO"}'::jsonb;
  v_tem    boolean;
  v_origem text;
begin
  -- Limpeza defensiva. `spaces` cascateia para as duas tabelas de
  -- documentação; `ai_bases` cascateia para `ai_base_documentacoes`.
  delete from public.spaces   where slug      like 'zz-tarefa9-assert-%';
  delete from public.ai_bases where base_code like 'zz-tarefa9-assert-%';

  insert into public.ai_bases (base_code, name) values (v_cod_a, v_cod_a) returning id into v_base_a;
  insert into public.ai_bases (base_code, name) values (v_cod_b, v_cod_b) returning id into v_base_b;

  insert into public.spaces (slug, name, type, visibility)
    values ('zz-tarefa9-assert-u1', 'zz-tarefa9-assert-u1', 'client', 'private') returning id into v_sp_u1;
  insert into public.spaces (slug, name, type, visibility)
    values ('zz-tarefa9-assert-u2', 'zz-tarefa9-assert-u2', 'client', 'private') returning id into v_sp_u2;
  insert into public.spaces (slug, name, type, visibility)
    values ('zz-tarefa9-assert-u3', 'zz-tarefa9-assert-u3', 'client', 'private') returning id into v_sp_u3;
  insert into public.spaces (slug, name, type, visibility)
    values ('zz-tarefa9-assert-u4', 'zz-tarefa9-assert-u4', 'client', 'private') returning id into v_sp_u4;
  insert into public.spaces (slug, name, type, visibility)
    values ('zz-tarefa9-assert-u5', 'zz-tarefa9-assert-u5', 'client', 'private') returning id into v_sp_u5;
  insert into public.spaces (slug, name, type, visibility)
    values ('zz-tarefa9-assert-b1', 'zz-tarefa9-assert-b1', 'client', 'private') returning id into v_sp_b1;

  insert into public.documentacoes_universais (space_id, enabled, regra) values
    (v_sp_u1, true,  '{}'::jsonb),
    (v_sp_u2, true,  '{}'::jsonb),
    (v_sp_u3, true,  '{}'::jsonb),
    (v_sp_u4, true,  '{"portal":["PG"]}'::jsonb),
    (v_sp_u5, false, '{}'::jsonb);

  insert into public.ai_base_documentacoes (base_id, space_id, enabled, regra) values
    (v_base_a, v_sp_u2, false, '{}'::jsonb),
    (v_base_a, v_sp_u3, true,  '{"portal":["PG"]}'::jsonb),
    (v_base_a, v_sp_u4, true,  '{}'::jsonb),
    (v_base_a, v_sp_u5, true,  '{}'::jsonb),
    (v_base_a, v_sp_b1, true,  '{}'::jsonb);

  -- ── 1. Universal SEM sobreposição alcança ─────────────────────────────
  select exists (select 1 from public.escopo_documentacao(v_cod_a, v_pg) e where e.space_id = v_sp_u1)
    into v_tem;
  assert v_tem,
    'assertiva 1: universal sem sobreposicao deveria alcancar a base A, e nao alcancou';

  select e.origem into v_origem
    from public.escopo_documentacao(v_cod_a, v_pg) e where e.space_id = v_sp_u1;
  assert v_origem = 'universal',
    format('assertiva 1: origem da universal sem sobreposicao deveria ser universal, veio %s', v_origem);
  raise notice 'assertiva 1 OK — universal sem sobreposicao alcanca, com origem universal';

  -- ── 2. Sobreposição com enabled=false ESCONDE (e só naquela base) ─────
  select exists (select 1 from public.escopo_documentacao(v_cod_a, v_pg) e where e.space_id = v_sp_u2)
    into v_tem;
  assert not v_tem,
    'assertiva 2: sobreposicao com enabled=false deveria ESCONDER a documentacao na base A, e ela apareceu';

  select exists (select 1 from public.escopo_documentacao(v_cod_b, v_pg) e where e.space_id = v_sp_u2)
    into v_tem;
  assert v_tem,
    'assertiva 2: esconder na base A nao pode esconder na base B, e a base B deixou de alcancar';
  raise notice 'assertiva 2 OK — enabled=false esconde na base A e NAO esconde na base B';

  -- ── 3. Sobreposição com regra ESTREITA ────────────────────────────────
  -- A universal é aberta: sem a sobreposição, PO alcançaria. Com ela, não.
  select exists (select 1 from public.escopo_documentacao(v_cod_a, v_po) e where e.space_id = v_sp_u3)
    into v_tem;
  assert not v_tem,
    'assertiva 3: identidade que passa na universal e NAO passa na regra da base nao pode alcancar, e alcancou';

  select exists (select 1 from public.escopo_documentacao(v_cod_a, v_pg) e where e.space_id = v_sp_u3)
    into v_tem;
  assert v_tem,
    'assertiva 3: identidade que passa nas DUAS regras deveria alcancar, e nao alcancou';

  -- A mesma documentação, na base B (sem sobreposição), continua aberta a
  -- PO: prova que o aperto é da base A e não virou regra global.
  select exists (select 1 from public.escopo_documentacao(v_cod_b, v_po) e where e.space_id = v_sp_u3)
    into v_tem;
  assert v_tem,
    'assertiva 3: estreitar na base A nao pode estreitar na base B, e a base B recusou a identidade PO';
  raise notice 'assertiva 3 OK — regra da base ESTREITA (PO fora, PG dentro) e so na base A';

  -- ── 4. Sobreposição NÃO ALARGA — a que prova a interseção ─────────────
  -- Universal restrita a PG, sobreposição da base liberando tudo. A
  -- identidade PO tem de CONTINUAR sem alcançar. Se alguém trocar
  -- interseção por substituição, esta é a assertiva que quebra.
  select exists (select 1 from public.escopo_documentacao(v_cod_a, v_po) e where e.space_id = v_sp_u4)
    into v_tem;
  assert not v_tem,
    'assertiva 4: sobreposicao ABERTA nao pode alargar universal restrita a PG — identidade PO alcancou, e a intersecao virou substituicao';

  select exists (select 1 from public.escopo_documentacao(v_cod_a, v_pg) e where e.space_id = v_sp_u4)
    into v_tem;
  assert v_tem,
    'assertiva 4: identidade PG deveria continuar alcancando a universal restrita a PG, e nao alcancou';
  raise notice 'assertiva 4 OK — sobreposicao ABERTA nao alarga universal restrita a PG (INTERSECAO)';

  -- ── 5. Anexo por base que NÃO é universal continua alcançando ─────────
  select exists (select 1 from public.escopo_documentacao(v_cod_a, v_pg) e where e.space_id = v_sp_b1)
    into v_tem;
  assert v_tem,
    'assertiva 5: anexo por base que nao e universal deveria alcancar, e nao alcancou';

  select e.origem into v_origem
    from public.escopo_documentacao(v_cod_a, v_pg) e where e.space_id = v_sp_b1;
  assert v_origem = 'base',
    format('assertiva 5: origem do anexo por base deveria ser base, veio %s', v_origem);

  select exists (select 1 from public.escopo_documentacao(v_cod_b, v_pg) e where e.space_id = v_sp_b1)
    into v_tem;
  assert not v_tem,
    'assertiva 5: anexo da base A nao pode aparecer na base B, e apareceu';
  raise notice 'assertiva 5 OK — anexo por base nao universal alcanca, com origem base, e so na base A';

  -- ── 6. Universal DESLIGADA é teto zero, e o cliente não reabre ────────
  -- Decisão de semântica documentada no cabeçalho de 20260925140000. Para
  -- devolver a documentação ao controle por base, APAGUE a linha universal.
  select exists (select 1 from public.escopo_documentacao(v_cod_a, v_pg) e where e.space_id = v_sp_u5)
    into v_tem;
  assert not v_tem,
    'assertiva 6: universal desligada e teto ZERO — linha da base com enabled=true nao pode reabrir, e reabriu';

  delete from public.documentacoes_universais where space_id = v_sp_u5;
  select exists (select 1 from public.escopo_documentacao(v_cod_a, v_pg) e where e.space_id = v_sp_u5)
    into v_tem;
  assert v_tem,
    'assertiva 6: APAGAR a linha universal deveria devolver a documentacao ao controle por base, e o anexo continuou invisivel';
  raise notice 'assertiva 6 OK — universal desligada e teto zero; APAGAR a linha devolve ao controle por base';

  -- Limpeza final.
  delete from public.spaces   where slug      like 'zz-tarefa9-assert-%';
  delete from public.ai_bases where base_code like 'zz-tarefa9-assert-%';
end $sobreposicao$;

-- =====================================================================
-- ASSERTIVA D — NBSP NO `p_base` NAS QUATRO FUNÇÕES (veio de 20260925160000)
--
-- Com o `btrim` de um argumento, `p_base` com NBSP não casava nenhuma base,
-- `base_alvo` ficava vazio e a cerca RECUSAVA o documento da PRÓPRIA base.
-- As assertivas do aparo em si (`codigo_normalizado`) e da COLISÃO no índice
-- único ficaram em 20260925160000, que é onde a função e o índice moram.
-- =====================================================================
do $nbsp$
declare
  v_cod  text := 'zz-t15-nbsp';
  v_base uuid;
  v_doc  uuid;
  v_sp   uuid;
  v_n    int;
  v_tem  boolean;
begin
  delete from public.spaces   where slug      like 'zz-t15-%';
  delete from public.ai_bases where base_code like 'zz-t15-%';

  insert into public.ai_bases (base_code, name) values (v_cod, v_cod) returning id into v_base;

  insert into public.knowledge_documents (base_id, storage_path, original_name, status)
    values (v_base, 'zz-t15/a.txt', 'zz-t15-doc.txt', 'ready')
    returning id into v_doc;

  insert into public.chunks (document_id, content)
    values (v_doc, 'Documento de teste zzmarcadortarefa15 pertence a base zz-t15-nbsp.');

  insert into public.spaces (slug, name, type, visibility)
    values ('zz-t15-espaco', 'zz-t15-espaco', 'client', 'private') returning id into v_sp;
  insert into public.ai_base_documentacoes (base_id, space_id, enabled, regra)
    values (v_base, v_sp, true, '{}'::jsonb);

  -- ── As duas funções de busca ─────────────────────────────────────────
  select count(*) into v_n
    from public.hybrid_search_scoped(
      p_query := 'zzmarcadortarefa15',
      p_document_ids := array[v_doc],
      p_limit := 5,
      p_group_limit := 5,
      p_base := v_cod || chr(160)
    );
  assert v_n = 1,
    format('hybrid_search_scoped com NBSP no p_base tem de resolver a MESMA base e devolver 1 linha, veio %s', v_n);

  select count(*) into v_n
    from public.knowledge_list_chunks(
      p_query := 'zzmarcadortarefa15',
      p_document_ids := array[v_doc],
      p_limit := 40,
      p_base := chr(9) || v_cod
    );
  assert v_n = 1,
    format('knowledge_list_chunks com TAB no p_base tem de resolver a MESMA base e devolver 1 linha, veio %s', v_n);

  -- E o contrário continua fechando: código de OUTRA base, mesmo com NBSP,
  -- não alcança este documento.
  select count(*) into v_n
    from public.hybrid_search_scoped(
      p_query := 'zzmarcadortarefa15',
      p_document_ids := array[v_doc],
      p_limit := 5,
      p_group_limit := 5,
      p_base := 'zz-t15-outra-base' || chr(160)
    );
  assert v_n = 0,
    format('hybrid_search_scoped com codigo de OUTRA base tem de recusar (ausencia fecha), veio %s', v_n);
  raise notice 'assertiva D.1 OK — as duas funcoes de busca tratam NBSP/TAB no p_base como a mesma base, e outra base continua recusada';

  -- ── As duas RPCs de metadado ─────────────────────────────────────────
  select exists (
    select 1 from public.documentos_da_base(v_cod || chr(160), '{}'::jsonb) d
     where d.document_id = v_doc
  ) into v_tem;
  assert v_tem,
    'documentos_da_base com NBSP no p_base tem de resolver a MESMA base, e nao resolveu';

  select exists (
    select 1 from public.escopo_documentacao(v_cod || chr(160), '{}'::jsonb) e
     where e.space_id = v_sp
  ) into v_tem;
  assert v_tem,
    'escopo_documentacao com NBSP no p_base tem de resolver a MESMA base, e nao resolveu';
  raise notice 'assertiva D.2 OK — documentos_da_base e escopo_documentacao tambem normalizam o p_base';

  delete from public.spaces   where slug      like 'zz-t15-%';
  delete from public.ai_bases where base_code like 'zz-t15-%';
end $nbsp$;

-- =====================================================================
-- ASSERTIVA E — `anon` CONSEGUE CHAMAR A BUSCA (veio de 20260925160000)
--
-- A regressão que a 20260925120000 introduziu e que nenhuma assertiva pegava: a
-- do `anon` (20260925116000) conta chunks alcançados, não verifica se ele
-- consegue chamar a busca. Esta assume o papel de verdade — `set local role`
-- funciona dentro de bloco anônimo, PL/pgSQL repassa `SET` ao motor SQL — e
-- chama as duas. Qualquer mudança futura que ponha uma tabela fechada ao `anon`
-- no plano delas para AQUI, em vez de virar busca vazia em produção.
--
-- `reset role` nos dois caminhos. No `exception`, ele é redundante (capturar a
-- exceção volta ao savepoint implícito do bloco, o que desfaz o SET LOCAL
-- junto) e fica por clareza, como em 20260925116000.
-- =====================================================================
do $anon$
declare
  v_hss int;
  v_klc int;
begin
  set local role anon;
  select count(*) into v_hss
    from public.hybrid_search_scoped(p_query := 'zzsondaanontarefa15', p_limit := 1);
  select count(*) into v_klc
    from public.knowledge_list_chunks(p_query := 'zzsondaanontarefa15', p_document_ids := '{}'::uuid[]);
  reset role;
  raise notice 'assertiva E OK — anon chamou hybrid_search_scoped (% linhas) e knowledge_list_chunks (% linhas) sem erro', v_hss, v_klc;
exception when others then
  reset role;
  raise exception
    'assertiva E: o papel anon NAO consegue chamar a busca (% / %). A busca publica do portal usa a chave anon (src/app/(portal)/actions.ts:141) e engole o erro como lista vazia. Causa provavel: alguma tabela sem grant para anon voltou para a range table de uma das duas funcoes, que sao security invoker — a base alvo tem de vir de public.bases_do_codigo, que e security definer.',
    sqlstate, sqlerrm;
end $anon$;

-- =====================================================================
-- ASSERTIVA F — ESTADO DE GRANT DAS CINCO FUNÇÕES (veio de 20260925160000)
--
-- `has_function_privilege('anon', ...)` responde verdadeiro quando é PUBLIC que
-- tem o privilégio, então negar `anon` e `authenticated` também prova que PUBLIC
-- não tem. As assertivas de grant de `codigo_normalizado` e de `regra_valida`
-- ficaram em 20260925160000, com as funções.
-- =====================================================================
do $grants$
begin
  -- As duas definer de metadado: SÓ service_role.
  assert not has_function_privilege('anon', 'public.escopo_documentacao(text, jsonb)', 'execute'),
    'escopo_documentacao nao pode ter EXECUTE para anon nem para PUBLIC';
  assert not has_function_privilege('authenticated', 'public.escopo_documentacao(text, jsonb)', 'execute'),
    'escopo_documentacao nao pode ter EXECUTE para authenticated: sendo definer ela ignora a RLS, e qualquer Leitor deduzia a regra do dono variando a identidade';
  assert has_function_privilege('service_role', 'public.escopo_documentacao(text, jsonb)', 'execute'),
    'escopo_documentacao tem de continuar executavel por service_role — e o unico chamador (escopo-da-base.ts, via createAdminClient)';

  assert not has_function_privilege('anon', 'public.documentos_da_base(text, jsonb)', 'execute'),
    'documentos_da_base nao pode ter EXECUTE para anon nem para PUBLIC';
  assert not has_function_privilege('authenticated', 'public.documentos_da_base(text, jsonb)', 'execute'),
    'documentos_da_base nao pode ter EXECUTE para authenticated: qualquer Leitor enumerava os ids dos arquivos internos de qualquer cliente';
  assert has_function_privilege('service_role', 'public.documentos_da_base(text, jsonb)', 'execute'),
    'documentos_da_base tem de continuar executavel por service_role';

  -- bases_do_codigo: anon PRECISA, e o motivo esta na assertiva E.
  assert has_function_privilege('anon', 'public.bases_do_codigo(text)', 'execute'),
    'bases_do_codigo TEM de ser executavel por anon: a busca do portal roda sem sessao e resolve a base por ela';
  assert has_function_privilege('authenticated', 'public.bases_do_codigo(text)', 'execute'),
    'bases_do_codigo tem de ser executavel por authenticated (Cmd+K e editor chamam a busca com sessao)';
  assert has_function_privilege('service_role', 'public.bases_do_codigo(text)', 'execute'),
    'bases_do_codigo tem de ser executavel por service_role (o widget)';

  -- As duas de busca seguem abertas: a do portal roda sem sessao.
  assert has_function_privilege('anon', 'public.hybrid_search_scoped(text, vector, uuid[], integer, uuid[], text, integer, text)', 'execute'),
    'hybrid_search_scoped tem de continuar executavel por anon (busca do portal)';
  assert has_function_privilege('anon', 'public.knowledge_list_chunks(text, uuid[], integer, text)', 'execute'),
    'knowledge_list_chunks tem de continuar executavel por anon';

  raise notice 'assertiva F OK — grants conferidos nas cinco funcoes deste arquivo';
end $grants$;

-- =====================================================================
-- ASSERTIVA G — `documentos_da_base` DEVOLVE SÓ `ready` (veio de 20260926100000)
--
-- O MESMO documento é consultado duas vezes, e a única coisa que muda entre as
-- duas é a coluna `status` — sem isso a prova mediria a existência do documento,
-- não o predicado. Os quatro valores possíveis (`queued`, `extracting`, `ready`,
-- `error`) vêm do CHECK `knowledge_documents_status_check`; os três que não são
-- `ready` são testados um a um, porque um predicado escrito como
-- `status <> 'queued'` passaria num teste só de `queued`.
-- =====================================================================
do $ready$
declare
  v_base uuid;
  v_doc  uuid;
  v_st   text;
  v_tem  boolean;
begin
  delete from public.knowledge_documents where original_name like 'zz-t13-%';
  delete from public.ai_bases            where base_code     like 'zz-t13-%';

  insert into public.ai_bases (base_code, name)
    values ('zz-t13-status', 'zz-t13-status') returning id into v_base;

  insert into public.knowledge_documents (base_id, storage_path, original_name, status, regra)
    values (v_base, 'zz-t13/planilha.xlsx', 'zz-t13-planilha.xlsx', 'ready', '{}'::jsonb)
    returning id into v_doc;

  -- O caso POSITIVO primeiro: se ele falhasse, os negativos abaixo passariam
  -- por motivo errado (documento que não existe também não sai).
  select exists (
    select 1 from public.documentos_da_base('zz-t13-status', '{}'::jsonb) d
     where d.document_id = v_doc
  ) into v_tem;
  assert v_tem,
    'documento com status ready TEM de sair de documentos_da_base, e nao saiu — o predicado esta cortando o que deveria passar';

  foreach v_st in array array['queued', 'extracting', 'error'] loop
    update public.knowledge_documents set status = v_st where id = v_doc;
    select exists (
      select 1 from public.documentos_da_base('zz-t13-status', '{}'::jsonb) d
       where d.document_id = v_doc
    ) into v_tem;
    assert not v_tem,
      format('documento com status %s NAO pode sair de documentos_da_base: chunks pela metade viram meia planilha afirmada como inteira', v_st);
  end loop;

  -- E de volta a `ready`: o MESMO documento volta a sair. Prova que o que
  -- decide é o status e nada mais.
  update public.knowledge_documents set status = 'ready' where id = v_doc;
  select exists (
    select 1 from public.documentos_da_base('zz-t13-status', '{}'::jsonb) d
     where d.document_id = v_doc
  ) into v_tem;
  assert v_tem,
    'o MESMO documento, de volta a ready, tem de sair — se nao sai, o que mudou nao foi o status';

  raise notice 'assertiva G OK — documentos_da_base devolve so status=ready (queued, extracting e error ficam fora, e o mesmo documento volta a sair em ready)';

  delete from public.knowledge_documents where original_name like 'zz-t13-%';
  delete from public.ai_bases            where base_code     like 'zz-t13-%';
end $ready$;
