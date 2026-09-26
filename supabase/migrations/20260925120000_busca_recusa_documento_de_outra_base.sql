-- =====================================================================
-- A BUSCA PASSA A RECUSAR DOCUMENTO DE OUTRA BASE, DENTRO DO BANCO
--
-- Hoje o isolamento entre clientes depende inteiramente de a aplicação
-- montar a lista de ids certa: o widget entra como `service_role`, que
-- tem `rolbypassrls`, e RLS nunca protege esse caminho. A tarefa 6 provou
-- que a aplicação acerta (`.audit/isolamento-documentacao-e2e.ts`). Esta
-- migration faz o BANCO recusar o erro, mesmo que a aplicação erre.
--
-- ── A cerca é de PROPRIEDADE, nunca de elegibilidade ──────────────────
-- O brief original desta tarefa mandava filtrar por
-- `public.documentos_da_base(p_base)`. Isso está ERRADO e foi corrigido
-- antes de chegar aqui: `documentos_da_base` tem `p_identidade jsonb
-- default '{}'::jsonb`, então filtrar por ela aqui dentro avaliaria
-- elegibilidade com identidade VAZIA — pela regra "ausência fecha", todo
-- documento restrito por portal/perfil/centro de custo seria recusado
-- mesmo para o usuário CERTO. Esta cerca não recalcula elegibilidade: ela
-- só verifica se `knowledge_documents.base_id`, quando existe, bate com a
-- base que pediu a busca.
--
-- ── Correção MEDIDA nesta tarefa, além das do brief ────────────────────
-- O brief desta tarefa (rescrito em 25/09) instrui usar `create or
-- replace` acrescentando `p_base` como novo parâmetro, e mandava
-- EXPLICITAMENTE não usar `drop function` da assinatura antiga ("devolve
-- EXECUTE a PUBLIC — não faça").
--
-- Medido antes de aplicar (script descartável, dentro de
-- BEGIN/ROLLBACK, nunca commitado): criar duas funções com o MESMO nome,
-- uma com N parâmetros e outra com N+1 (o N+1º com DEFAULT), e chamar
-- só com os primeiros N nomeados — exatamente como o app chama hoje via
-- `supabase.rpc(nome, {...})` — produz:
--
--   ERROR: function public.zz_teste_overload(p_query => unknown,
--   p_node_ids => unknown) is not unique
--
-- Ou seja: `create or replace function` com um parâmetro A MAIS não
-- substitui a função antiga — cria uma SEGUNDA função (assinatura
-- diferente = função diferente, para o Postgres). Com as duas de pé,
-- TODA chamada existente que não passa `p_base` fica AMBÍGUA entre as
-- duas, e quebra em produção com "function ... is not unique" — a busca
-- do chat e do portal inteiros parariam de responder.
--
-- Isto não é hipótese: é o padrão já estabelecido NESTE repositório para
-- esta MESMA função, em pelo menos quatro migrations anteriores
-- (20260720140000, 20260721131000, 20260725120000, 20260805130000) —
-- todas fazem `drop function if exists <assinatura antiga>` antes do
-- `create or replace` sempre que `hybrid_search_scoped` ganha parâmetro
-- novo, com o comentário "Assinatura muda (ganha 1 arg) → precisa DROP
-- antes do CREATE (padrão do repo)" na mais recente delas. A instrução
-- deste brief de NÃO fazer o drop contradiz o próprio padrão que o
-- repositório já usa há meses para o mesmo cenário, e aplicá-la como
-- escrita quebraria produção. Este arquivo segue o padrão do repo, não
-- o texto literal do brief nesse ponto específico.
--
-- O risco que o brief queria evitar (o `drop` devolver EXECUTE a PUBLIC)
-- foi verificado e não se aplica aqui: nenhuma migration jamais revogou
-- EXECUTE destas duas funções de `anon`/`public` (checado por grep em
-- todo `supabase/migrations/`), então não há revoke de migration
-- posterior para desfazer. O privilégio atual — EXECUTE aberto a
-- PUBLIC (portanto a `anon` também) — é o comportamento ORIGINAL destas
-- funções desde a criação, preservado aqui sem nenhuma instrução de
-- grant nova: elas rodam `SECURITY INVOKER` (não têm `SECURITY DEFINER`),
-- então quando `anon` chama, a leitura de `chunks` continua governada
-- pela RLS de `anon` (`chunks_public_read`), exatamente como hoje.
--
-- NÃO revogar de `anon` nesta função nem em `knowledge_list_chunks`,
-- mesmo que a restrição global do projeto mande "função nova: revoke de
-- public, anon". Estas não são novas: a busca do portal chama
-- `hybrid_search_scoped` como `anon`, sem sessão nenhuma
-- (`src/app/(portal)/actions.ts:141`). Aplicar aquela regra aqui reproduz
-- exatamente o incidente que `20260721140000_search_anon_knowledge_grant.sql`
-- documenta: a busca do portal morre com "permission denied", e a action
-- engole o erro como lista vazia — silencioso, igual ao defeito que esta
-- própria migration corrige em outro lugar.
--
-- Acoplamento com a RLS, para quem for mexer em policy depois: como as
-- duas funções são `SECURITY INVOKER`, o `not exists` desta cerca só diz a
-- verdade porque, para `authenticated`, a permissão que abre o CHUNK de
-- arquivo de base (`chunks_auth_read`, exige `ai.configure`) é a MESMA que
-- abre a LINHA de `knowledge_documents` que a cerca lê (`knowledge_
-- documents_read`, também `ai.configure`). Se uma das duas policies for
-- estreitada sem a outra, a cerca passa a enxergar "não existe documento
-- de outra base" para um `authenticated` que só não tem permissão de
-- LER a tabela — abrindo em silêncio, não fechando. Hoje isto é inofensivo
-- porque `p_base` só chega por `service_role` (que tem `rolbypassrls` e
-- não passa pela RLS de jeito nenhum), mas a dependência existe e fica
-- registrada aqui.
--
-- ── Onde a cerca entra ─────────────────────────────────────────────────
-- UM lugar só em cada função: no CTE `agrupado` de `hybrid_search_scoped`
-- (upstream de `melhores_grupos` — um documento de outra base é
-- descartado ANTES de consumir vaga de grupo) e no `where` de
-- `knowledge_list_chunks`. As quatro CTEs de sinal (`ft`, `trg`, `vec`,
-- `boost`) e a fusão RRF ficam INTOCADAS — repetir a cerca nelas seria
-- duplicação, e não muda o resultado porque `agrupado`/`melhores_grupos`
-- já filtram depois.
--
-- `not exists (select 1 from base_alvo ba where ba.id = d.base_id)`, não
-- uma subconsulta ESCALAR: `ai_bases_base_code_key` é `unique(base_code)`,
-- case-sensitive e sem trim — 'Natcorp' e 'natcorp ' coexistem
-- legitimamente hoje (conferido: não coexistem AINDA, mas a constraint não
-- impede). No dia em que coexistirem, `base_alvo` (que normaliza com
-- `lower(btrim(...))`) devolveria DUAS linhas, e `(select id from
-- base_alvo)` como subconsulta escalar levantaria `more than one row
-- returned by a subquery used as an expression` — erro que `rag.ts` não
-- veria, porque as quatro chamadas desestruturam só `{ data }` e ignoram
-- `error`: a busca daquela base voltaria vazia, em silêncio, sem
-- documentação nenhuma. `not exists` com JOIN de pertinência tolera
-- `base_alvo` com zero, uma ou várias linhas sem erro nenhum, e preserva a
-- MESMA postura "ausência fecha": com `base_alvo` vazio (p_base nulo, ou
-- código que não bate com nenhuma base) nada casa a pertinência, o `not
-- exists` externo é falso e todo documento de base é recusado — idêntico
-- ao que o `is distinct from` fazia antes desta correção.
--
-- `d.base_id is not null`: deixa passar documento de ESPAÇO (documentação
-- anexada, `base_id` nulo) e, por `d.id = c2.document_id` nunca casar
-- quando `document_id` é nulo, também o chunk de ARTIGO. Sem isso a
-- cerca cortaria a documentação inteira.
--
-- ── O que esta cerca NÃO cobre ──────────────────────────────────────────
-- Ela recusa arquivo INTERNO de outra base (o caso em que o custo do erro
-- deixa de ser "resposta errada" e passa a ser "documento interno de um
-- cliente exposto a outro"). Ela NÃO recusa uma documentação de ESPAÇO
-- que outra base anexou e esta não — pegar isso exigiria recalcular
-- elegibilidade aqui dentro, que é justamente o que esta cerca se recusa
-- a fazer. Esse caso continua coberto só pela aplicação
-- (`resolverEscopoDaBase`) e pela prova da tarefa 6.
--
-- ── CORPO SUPERADO EM PARTE, E REAPLICAR SOZINHO QUEBRA O PORTAL ───────
-- Os corpos das duas funções que estão aqui resolvem a base com
-- `from public.ai_bases` dentro da CTE `base_alvo`. Isso quebrou a busca pública
-- do portal, e foi medido em 25/09 assumindo o papel `anon`:
--
--   hybrid_search_scoped(p_query := 'ferias', p_limit := 3)
--     -> ERRO 42501: permission denied for table ai_bases
--
-- `anon` tem grant em `chunks`, `nodes` e `knowledge_documents`, e NENHUM em
-- `ai_bases`. Estas duas funções são `security invoker`, e a permissão de tabela
-- é conferida no INÍCIO da execução para toda entrada da range table — não
-- quando a linha é lida. Então nem o `p_base is null` do portal salva: bastava a
-- tabela estar no plano. `searchPortal` usa `createPublicClient()` (chave `anon`)
-- e só registra `console.error`, então o sintoma é resultado vazio. É o mesmo
-- modo de falha que o comentário sobre `20260721140000` acima previne para
-- grant, produzido por outra porta.
--
-- A `20260925160000_branco_unico_e_grants.sql` corrige: a base alvo passa a vir
-- de `public.bases_do_codigo(text)`, que é `security definer` — chamada de função
-- não é entrada de range table. A mesma migration troca o `lower(btrim(...))` de
-- um argumento pelo aparo de cinco caracteres de `public.codigo_normalizado`.
--
-- A ASSINATURA não muda, então reaplicar ESTE arquivo sozinho não cria função
-- duplicada: ele devolve `public.ai_bases` para a range table e MATA a busca do
-- portal outra vez, em silêncio, além de voltar o aparo de um caractere.
-- Reaplique a 20260925160000 depois, SEMPRE. A assertiva 5 da 160000 é o que
-- pega isso: ela assume o papel `anon` e chama as duas funções.
-- =====================================================================

drop function if exists public.hybrid_search_scoped(text, vector, uuid[], integer, uuid[], text, integer);

create or replace function public.hybrid_search_scoped(
  p_query text,
  p_embedding vector default null,
  p_node_ids uuid[] default null,
  p_limit integer default 8,
  p_document_ids uuid[] default null,
  p_boost text default null,
  p_group_limit integer default 2,
  -- NOVO: code da base que pediu a busca. Null preserva TODOS os
  -- chamadores atuais (portal, Cmd+K, editor) sem mudar comportamento.
  p_base text default null
)
returns table (node_id uuid, document_id uuid, title text, heading_path text, snippet text, content text, score double precision)
language sql
stable
set search_path to 'public', 'extensions'
as $function$
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
  -- Base(s) alvo desta busca (id de `ai_bases`), resolvida(s) UMA vez.
  -- Vazio quando `p_base` é nulo OU não bate com nenhuma base cadastrada
  -- — os dois casos fecham a cerca (ver `not exists` abaixo). PODE devolver
  -- mais de uma linha se `base_code` colidir depois de normalizar — por
  -- isso o consumo abaixo é `not exists`/pertinência, nunca subconsulta
  -- escalar.
  base_alvo as (
    select b.id
      from public.ai_bases b
     where p_base is not null
       and lower(btrim(b.base_code)) = lower(btrim(p_base))
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
  'Busca híbrida (RRF: full-text + trigram + vetor + boost) escopada por nós/documentos. `p_base` é cerca de PROPRIEDADE (knowledge_documents.base_id), nunca de elegibilidade — nulo preserva todo chamador sem base.';

-- knowledge_list_chunks: o caminho de ENUMERAÇÃO ("todos os X de Y"), que
-- devolve até 40 chunks por documento em vez de 1 — o pior lugar para
-- deixar sem cerca, porque é o que mais despeja conteúdo no prompt.
drop function if exists public.knowledge_list_chunks(text, uuid[], integer);

create or replace function public.knowledge_list_chunks(
  p_query text,
  p_document_ids uuid[],
  p_limit integer default 40,
  p_base text default null
)
returns table (document_id uuid, title text, heading_path text, content text, score double precision)
language sql
stable
set search_path to 'public', 'extensions'
as $function$
  with base_alvo as (
    select b.id
      from public.ai_bases b
     where p_base is not null
       and lower(btrim(b.base_code)) = lower(btrim(p_base))
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
    -- de pertinência (não subconsulta escalar) pelo mesmo motivo de lá:
    -- `base_alvo` pode devolver mais de uma linha se `base_code` colidir
    -- depois de `lower(btrim(...))` — ver o comentário completo acima.
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
  'Enumeração: todos os chunks (até 40) dos documentos que casam a consulta. `p_base` é a MESMA cerca de propriedade de hybrid_search_scoped — nulo preserva todo chamador sem base.';

-- =====================================================================
-- ASSERTIVA OBRIGATÓRIA — comportamental, não de substring
--
-- Cria duas bases e um documento de BASE em cada, com o MESMO token no
-- conteúdo dos dois (para os dois competirem pela mesma busca), roda as
-- duas funções com `p_base` nulo, com `p_base` de uma base que EXISTE e
-- com `p_base` de uma base que NÃO existe (o caso que distingue "fecha" de
-- "abre em silêncio" — ver comentário na seção correspondente), e limpa
-- tudo (delete explícito, mesma transação) antes do fim do bloco — se
-- qualquer `assert` falhar, a exceção aborta a transação inteira do
-- arquivo e o `migrate:apply`
-- reverte junto (nenhuma linha de teste sobrevive nos dois caminhos).
-- =====================================================================
do $$
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

  -- ── p_base que NÃO existe em ai_bases (rodada de correção 1) ────────
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
end $$;

-- =====================================================================
-- ASSERTIVA DE ASSINATURA ÚNICA — a que pega a reaplicação de arquivo antigo
--
-- Sete migrations anteriores criam `hybrid_search_scoped` com 4, 5, 6 ou 7
-- parâmetros, e uma cria `knowledge_list_chunks` com 3. Todas usam `create or
-- replace`, e nenhuma derruba a assinatura ATUAL (nem poderia: ela nasceu aqui).
-- Reaplicar qualquer uma delas à mão deixa DUAS funções do mesmo nome de pé, e a
-- partir daí toda chamada do app — `supabase.rpc(nome, {...})`, que não nomeia
-- todos os parâmetros — levanta `function ... is not unique`. As cinco chamadas
-- de `src/lib/ai/rag.ts` e de `src/app/(portal)/actions.ts` desestruturam só
-- `{ data }`: o erro não aparece em log nenhum e a BUSCA DEVOLVE VAZIO.
--
-- Os oito arquivos ganharam cabeçalho de aviso na tarefa 12. Isto aqui é a rede
-- de baixo: toda vez que ESTE arquivo for aplicado, ele recusa um banco onde a
-- duplicata já existe, em vez de deixar a aplicação "passar" e a busca morrer
-- depois. E `npm run verificar:rpc` (`.audit/assinatura-unica-de-rpc.ts`) faz a
-- mesma checagem para TODAS as RPCs que `src/` chama, sem depender de aplicar
-- migration nenhuma.
--
-- `count(*) = 1` e não `>= 1` de propósito: zero também é defeito (função que o
-- app chama e não existe devolve o mesmo vazio silencioso).
-- =====================================================================
do $$
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
end $$;
