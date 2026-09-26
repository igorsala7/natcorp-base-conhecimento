-- =====================================================================
-- O "BRANCO" PASSA A SER UM SÓ, E AS DUAS RPCs DE METADADO SAEM DE authenticated
--
-- ── (1) O defeito com consequência ENTRE CLIENTES ─────────────────────
-- `btrim(x)` com um argumento apara SÓ o caractere espaço. Medido contra o
-- banco: `btrim('natcorp' || chr(160)) = 'natcorp'` é FALSE.
--
-- Já `public.allowlist_casa`, por onde `public.elegivel` passa TODA dimensão,
-- apara CINCO caracteres (espaço, TAB, LF, CR, NBSP) desde
-- `20260925010000_paridade_aparo_e_regra_malformada.sql`, e o comentário dela
-- diz que o conjunto aparece uma vez de propósito "para não corrigir dois e
-- esquecer o terceiro".
--
-- As funções novas deste ramo e o índice único de `ai_bases` ficaram com o
-- `btrim` de UM argumento. A consequência vem em dois passos e atravessa a
-- fronteira de cliente:
--
--   · o índice único aceita 'natcorp' e 'natcorp'+NBSP como bases DISTINTAS,
--     porque para ele os dois textos são diferentes;
--   · a dimensão `base` de `elegivel` trata as duas como a MESMA, porque ela
--     apara o NBSP.
--
-- Uma documentação universal restrita a `{"base":["natcorp"]}` passa então a
-- alcançar os usuários da OUTRA base. É conteúdo atravessando fronteira de
-- cliente, e NBSP é exatamente o que vem de um colar de planilha ou de página
-- web: ninguém digita, ninguém vê, e nenhuma tela mostra a diferença.
--
-- A correção é uma função só, `public.codigo_normalizado(text)`, com o conjunto
-- de branco aparecendo UMA vez neste arquivo — a mesma lição de
-- `allowlist_casa`. Ela entra nas quatro funções do ramo e no índice único.
--
-- ── (2) As duas RPCs de metadado saem de `authenticated` ───────────────
-- `escopo_documentacao` e `documentos_da_base` são `security definer`, logo
-- ignoram a RLS das quatro tabelas que leem, e tinham EXECUTE para
-- `authenticated`. Qualquer autenticado — um Leitor de nível 10 — podia chamar
-- `documentos_da_base('cliente-x','{}')` e ENUMERAR os ids dos arquivos internos
-- daquele cliente, e variar a identidade em `escopo_documentacao` até deduzir a
-- regra do dono. Não é conteúdo (ler os chunks exige `ai.configure`): é metadado
-- mais oráculo.
--
-- Verificado antes de revogar: o ÚNICO chamador das duas é
-- `src/lib/ai/escopo-da-base.ts:105-106`, alcançado por `retrievePublicContext`,
-- que monta o cliente com `createAdminClient()` (`service_role`). Não existe
-- chamador `authenticated`, então revogar não quebra tela nenhuma. A assertiva
-- lá embaixo fixa os três papéis com `has_function_privilege`, porque hoje nada
-- fixa isso — e `has_function_privilege('anon', ...)` responde verdadeiro quando
-- é PUBLIC que tem o privilégio, então negar `anon` e `authenticated` também
-- prova que PUBLIC não tem.
--
-- ── (3) A REGRESSÃO QUE ESTE ARQUIVO ENCONTROU E CORRIGE ──────────────
-- Medido em 25/09, depois de aplicar a 20260925120000, assumindo o papel `anon`
-- de verdade:
--
--   hybrid_search_scoped(p_query := 'ferias', p_limit := 3)
--     -> ERRO 42501: permission denied for table ai_bases
--   knowledge_list_chunks(...)              -> o MESMO erro
--   como `authenticated`                    -> funciona
--
-- A BUSCA PÚBLICA DO PORTAL ESTÁ MORTA desde que a 120000 foi aplicada, e
-- silenciosamente: `searchPortal` (`src/app/(portal)/actions.ts:141`) usa
-- `createPublicClient()` (chave `anon`) para todo espaço público, e a única
-- pista é um `console.error`.
--
-- A causa não é grant de função: é que a 120000 pôs `from public.ai_bases` DENTRO
-- da CTE `base_alvo` das duas funções, que são `security invoker`. `anon` não tem
-- grant nenhum em `ai_bases` (tem em `chunks`, `nodes` e `knowledge_documents`) —
-- e a permissão de tabela é conferida no INÍCIO da execução, para toda entrada da
-- range table, não quando a linha é lida. Então nem o `p_base is null` do portal
-- salva: a CTE não precisa devolver linha para o erro acontecer, basta a tabela
-- estar no plano. O cabeçalho da própria 120000 previu este modo de falha ("a
-- busca do portal morre com permission denied, e a action engole o erro como
-- lista vazia") e o produziu por outra porta.
--
-- A correção é tirar `ai_bases` da range table do INVOKER:
-- `public.bases_do_codigo(text)`, `security definer`, devolve os ids das bases
-- cujo código normalizado bate com o pedido. Chamada de função não é entrada de
-- range table, então nenhuma permissão de tabela é exigida do chamador. As duas
-- funções de busca passam a resolver a base por ela, e é por ela que elas usam
-- `codigo_normalizado` — chamar o normalizador direto não resolveria nada, porque
-- o problema nunca foi o normalizador, foi a TABELA no plano do invoker.
--
-- E o que faltava era assertiva: a única do `anon` (20260925116000) conta chunks
-- que ele alcança, não verifica se ele consegue CHAMAR a busca. A assertiva 5
-- deste arquivo assume o papel `anon` e chama as duas funções; qualquer mudança
-- futura que volte a pôr uma tabela fechada ao `anon` no plano delas para nesta
-- linha, em vez de virar busca vazia em produção.
--
-- Custo desta escolha, escrito para o dono decidir se aceita: `bases_do_codigo`
-- é `security definer` com EXECUTE para `anon`, logo é um oráculo de EXISTÊNCIA
-- de código de base — quem adivinhar 'natcorp' recebe um uuid. O uuid não abre
-- nada: a policy de `anon` em `knowledge_documents` é `false`, e em `ai_bases` o
-- `anon` continua sem grant. A alternativa era `grant select on ai_bases to
-- anon` contando com a RLS para devolver zero linhas, que entrega a TABELA
-- inteira (nome, base_url, credential_id) atrás de uma policy, e é a classe de
-- "grant que sobrepõe o revoke" que este repositório já pagou.
--
-- ── (4) Itens menores da mesma revisão ────────────────────────────────
-- `revoke` de `regra_valida` (nasceu com o grant padrão do Supabase e era a
-- única função nova do ramo sem revoke; `authenticated` tem grant explícito, e é
-- ele que precisa dela para o CHECK de gravação continuar funcionando);
-- `check` de código de base não-branco; índice em `knowledge_documents(base_id)`
-- e em `ai_base_documentacoes(space_id)`, os dois caminhos que as funções deste
-- ramo percorrem sem índice.
--
-- ── `create or replace` nas quatro, e `drop` PROIBIDO aqui ────────────
-- Nenhuma assinatura muda. `drop function` + `create` devolveria EXECUTE a
-- PUBLIC e desfaria justamente os revokes que este ramo passou a rodada
-- fechando. É a situação oposta à da 20260925120000, onde a assinatura ganhou
-- parâmetro e o drop era obrigatório.
-- =====================================================================

-- ── O normalizador, com o conjunto de branco aparecendo UMA vez ──────
-- `immutable` porque um índice único depende dela. O conjunto é montado com
-- `chr()` e não com E'...': caractere invisível dentro do fonte atravessa
-- revisão sem ninguém ver, e basta um editor trocá-lo por espaço para a
-- correção virar nada (neste repositório dois bytes NUL num fonte já
-- esconderam uma colisão).
--
-- NÃO propaga `coalesce`: nulo entra, nulo sai. Isso é decisão, não descuido.
-- Com `coalesce(x,'')` dois `base_code` nulos passariam a colidir no índice
-- (hoje não colidem, porque índice único ignora nulo), e um `p_base` nulo
-- casaria com um `base_code` em branco. Nulo que não casa com nada é a postura
-- "ausência fecha" do projeto, aplicada ao texto.
--
-- Quem alterar esta função ALTERA A EXPRESSÃO DE UM ÍNDICE ÚNICO: o índice
-- existente não é reconstruído sozinho e passa a mentir. Mudança aqui exige
-- `reindex table public.ai_bases` na mesma migration.
create or replace function public.codigo_normalizado(p_codigo text)
returns text
language sql
immutable parallel safe
as $$
  select lower(btrim(p_codigo, ' ' || chr(9) || chr(10) || chr(13) || chr(160)));
$$;

comment on function public.codigo_normalizado(text) is
  'Código de base comparável: minúsculo e sem branco nas pontas, onde "branco" é espaço, TAB, LF, CR e NBSP — o MESMO conjunto de public.allowlist_casa, para a dimensão `base` de public.elegivel e o índice único de ai_bases não discordarem. Nulo entra, nulo sai (ausência fecha). É expressão de índice único: alterar exige reindex de ai_bases.';

revoke all on function public.codigo_normalizado(text) from public, anon;
-- `authenticated` precisa: ele escreve em `ai_bases`, e tanto o CHECK quanto a
-- expressão do índice único são avaliados como o usuário que grava.
grant execute on function public.codigo_normalizado(text) to authenticated, service_role;

-- ── A base alvo, resolvida FORA da range table do invoker ────────────
-- Ver seção (3) do cabeçalho. `security definer` não é conveniência: é o que
-- tira `public.ai_bases` do plano de `hybrid_search_scoped` e
-- `knowledge_list_chunks`, que são `security invoker` e são chamadas por `anon`.
create or replace function public.bases_do_codigo(p_base text)
returns setof uuid
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $$
  select b.id
    from public.ai_bases b
   where p_base is not null
     and public.codigo_normalizado(b.base_code) = public.codigo_normalizado(p_base);
$$;

comment on function public.bases_do_codigo(text) is
  'Ids das bases cujo base_code normalizado bate com p_base. PODE devolver zero, uma ou várias linhas (nunca é consumida como subconsulta escalar). Existe como security definer para que hybrid_search_scoped e knowledge_list_chunks, que são security invoker e são chamadas por `anon`, não tenham public.ai_bases na range table: a permissão de tabela é conferida no início da execução, então bastava a tabela estar no plano para `anon` receber permission denied e a busca do portal devolver vazio em silêncio.';

revoke all on function public.bases_do_codigo(text) from public;
-- `anon` explicitamente, e com o motivo escrito: a busca do portal roda como
-- `anon`, sem sessão (`src/app/(portal)/actions.ts:141`). Sem este grant, a
-- restrição global "função nova: revoke de public, anon" reproduz exatamente o
-- incidente que 20260721140000_search_anon_knowledge_grant.sql documenta.
grant execute on function public.bases_do_codigo(text) to anon, authenticated, service_role;

-- ── Nenhuma colisão pode existir antes do índice novo ────────────────
-- O índice de 20260925130000 apara um caractere; este apara cinco, então ele
-- agrupa MAIS: tudo que o antigo recusava, o novo também recusa, e mais. Se duas
-- bases já diferirem apenas por NBSP/TAB/LF/CR, o `create unique index` abaixo
-- falharia com uma mensagem que não diz o que fazer. Aqui ele PARA e diz.
--
-- Medido em 25/09: 14 linhas, 14 códigos normalizados distintos, zero colisões.
do $$
declare
  v_colisoes int;
begin
  select count(*) into v_colisoes
    from (
      select public.codigo_normalizado(base_code)
        from public.ai_bases
       group by 1
      having count(*) > 1
    ) x;

  if v_colisoes > 0 then
    raise exception
      'PARE: % codigo(s) de base colidem depois do aparo de cinco caracteres. Qual linha fica e decisao do dono, nao desta migration. Diagnostico: select public.codigo_normalizado(base_code) as norm, count(*), array_agg(base_code) from public.ai_bases group by 1 having count(*) > 1;',
      v_colisoes;
  end if;
end $$;

-- ── Índice único novo ANTES de derrubar o antigo ─────────────────────
-- Nesta ordem não existe instante sem trava: enquanto o novo é criado, o antigo
-- ainda vale, e o novo é estritamente mais forte que ele. Não é `concurrently`
-- porque `scripts/apply-migrations.ts` envolve o arquivo em begin/commit e
-- `create index concurrently` não roda em transação — e a tabela tem 14 linhas.
create unique index if not exists ai_bases_codigo_normalizado_key
  on public.ai_bases (public.codigo_normalizado(base_code));

comment on index public.ai_bases_codigo_normalizado_key is
  'Unicidade do base_code normalizado pelo MESMO aparo de public.allowlist_casa (espaço, TAB, LF, CR, NBSP). Substitui ai_bases_base_code_normalizado_key, que usava btrim de um argumento e aceitava natcorp e natcorp+NBSP como bases distintas — enquanto a dimensão `base` de public.elegivel tratava as duas como a mesma, fazendo uma documentação restrita a uma base alcançar os usuários da outra.';

drop index if exists public.ai_bases_base_code_normalizado_key;

-- ── Código de base em branco deixa de existir ────────────────────────
-- Com o normalizador e não com `btrim(base_code) <> ''`: o `btrim` de um
-- argumento aceitaria um código feito só de NBSP, cujo normalizado é vazio, e aí
-- um `p_base` vazio casaria com ele. Fechar pelo normalizador fecha as duas
-- coisas de uma vez, e é o único jeito de o CHECK e o índice concordarem.
alter table public.ai_bases drop constraint if exists ai_bases_codigo_nao_branco;
alter table public.ai_bases
  add constraint ai_bases_codigo_nao_branco check (public.codigo_normalizado(base_code) <> '');

-- ── Os dois caminhos sem índice ──────────────────────────────────────
-- `knowledge_documents(base_id)`: `documentos_da_base` e a cerca de propriedade
-- das duas funções de busca filtram por ele. `ai_base_documentacoes(space_id)`:
-- o `left join` do ramo 1 de `escopo_documentacao` entra por space_id, e a chave
-- primária é (base_id, space_id), que não serve para esse lado.
create index if not exists knowledge_documents_base_idx
  on public.knowledge_documents (base_id);
create index if not exists ai_base_documentacoes_space_idx
  on public.ai_base_documentacoes (space_id);

-- ── regra_valida sai de PUBLIC ───────────────────────────────────────
-- Nasceu com o grant padrão do Supabase e era a única função nova do ramo sem
-- revoke. `authenticated` mantém o grant explícito: é ele que grava nas três
-- tabelas cujo CHECK a chama, e CHECK é avaliado como quem grava.
revoke all on function public.regra_valida(jsonb) from public, anon;
grant execute on function public.regra_valida(jsonb) to authenticated, service_role;

-- =====================================================================
-- AS QUATRO FUNÇÕES PASSAM AO NORMALIZADOR ÚNICO
-- `create or replace` nas quatro. Nenhuma assinatura muda, então `drop` é
-- proibido aqui (ver cabeçalho).
-- =====================================================================

-- ── 1/4 escopo_documentacao (corpo de 20260925140000) ────────────────
create or replace function public.escopo_documentacao(
  p_base text,
  p_identidade jsonb default '{}'::jsonb
)
returns table (space_id uuid, origem text)
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $$
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
$$;

comment on function public.escopo_documentacao(text, jsonb) is
  'Documentações que esta identidade alcança nesta base. A linha de ai_base_documentacoes é SOBREPOSIÇÃO sobre a universal e só ESTREITA: sem linha vale a universal; enabled=false esconde; enabled=true exige as DUAS regras (interseção, nunca substituição — a regra da Natcorp é teto). Enquanto existir linha universal ela é o teto, inclusive desligada: para devolver a documentação ao controle por base, APAGUE a linha universal. O segundo ramo devolve só anexo por base que não é universal. Base desconhecida devolve só as universais. O base_code é comparado por public.codigo_normalizado (mesmo aparo de allowlist_casa). Escopo da chave do widget NÃO passa por aqui: ele é somado pela aplicação (decidirEscopo) e se retira em /admin/widget.';

-- `authenticated` SAI: security definer ignora a RLS das tabelas que esta função
-- lê, e o único chamador é service_role (ver cabeçalho, seção 2).
revoke all on function public.escopo_documentacao(text, jsonb) from public, anon, authenticated;
grant execute on function public.escopo_documentacao(text, jsonb) to service_role;

-- ── 2/4 documentos_da_base (corpo de 20260925110000) ─────────────────
create or replace function public.documentos_da_base(
  p_base text,
  p_identidade jsonb default '{}'::jsonb
)
returns table (document_id uuid)
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $$
  select k.id
    from public.knowledge_documents k
    join public.ai_bases b on b.id = k.base_id
   where k.base_id is not null
     and public.codigo_normalizado(b.base_code) = public.codigo_normalizado(p_base)
     and public.elegivel(k.regra, p_identidade);
$$;

comment on function public.documentos_da_base(text, jsonb) is
  'Arquivos DE CLIENTE que esta identidade alcança nesta base, filtrados por public.elegivel. Nunca devolve arquivo de outra base: o join por base_code normalizado (public.codigo_normalizado) é a cerca, e o teste de isolamento em .audit/ é o que a prova. EXECUTE só para service_role: sendo security definer ela ignora a RLS, e com grant a authenticated qualquer Leitor enumerava os ids dos arquivos internos de qualquer cliente.';

revoke all on function public.documentos_da_base(text, jsonb) from public, anon, authenticated;
grant execute on function public.documentos_da_base(text, jsonb) to service_role;

-- ── 3/4 hybrid_search_scoped (corpo de 20260925120000) ───────────────
-- A ÚNICA mudança no corpo é a CTE `base_alvo`, que deixa de ler
-- `public.ai_bases` e passa a chamar `public.bases_do_codigo`. Toda a cerca, os
-- quatro sinais e a fusão RRF ficam idênticos — ver 20260925120000 para o
-- raciocínio completo de cada pedaço.
create or replace function public.hybrid_search_scoped(
  p_query text,
  p_embedding vector default null,
  p_node_ids uuid[] default null,
  p_limit integer default 8,
  p_document_ids uuid[] default null,
  p_boost text default null,
  p_group_limit integer default 2,
  -- Code da base que pediu a busca. Null preserva TODOS os chamadores sem base
  -- (portal, Cmd+K, editor) sem mudar comportamento.
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

-- Privilégio restatado de propósito (o `replace` preserva o ACL, mas o arquivo
-- tem de ser auto-suficiente): EXECUTE segue ABERTO a PUBLIC/`anon`, porque a
-- busca do portal roda sem sessão. Sendo `security invoker`, a leitura de
-- `chunks` continua governada pela RLS de quem chama.
grant execute on function public.hybrid_search_scoped(text, vector, uuid[], integer, uuid[], text, integer, text) to public;

-- ── 4/4 knowledge_list_chunks (corpo de 20260925120000) ──────────────
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
-- ASSERTIVAS — comportamentais, e cada uma falha por um motivo diferente
--
-- Molde das migrations 120000/140000: dado com prefixo `zz-`, limpeza defensiva
-- na entrada e limpeza explícita na saída. Não há `rollback` dentro de bloco
-- anônimo; o que garante que nada sobrevive a uma falha é
-- `scripts/apply-migrations.ts`, que envolve o arquivo em begin/commit.
--
--   1. aparo de cinco caracteres em `codigo_normalizado`, incluindo NBSP
--   2. as duas funções de busca tratam `p_base` com NBSP como a mesma base
--   3. as duas RPCs de metadado idem
--   4. duas bases que diferem por NBSP COLIDEM (o furo entre clientes)
--   5. `anon` consegue CHAMAR as duas funções de busca (a regressão da 120000)
--   6. estado de grant dos três papéis, nas cinco funções
-- =====================================================================
do $$
declare
  v_cod      text := 'zz-t12-nbsp';
  v_base     uuid;
  v_doc      uuid;
  v_sp       uuid;
  v_n        int;
  v_recusou  boolean;
  v_tem      boolean;
begin
  -- ── 1. O aparo ──────────────────────────────────────────────────────
  assert public.codigo_normalizado('natcorp' || chr(160)) = 'natcorp',
    'codigo_normalizado tem de aparar NBSP — e o btrim de um argumento nao aparava';
  assert public.codigo_normalizado(chr(9) || 'NatCorp' || chr(10)) = 'natcorp',
    'codigo_normalizado tem de aparar TAB e LF e baixar a caixa';
  assert public.codigo_normalizado(chr(13) || ' natcorp ') = 'natcorp',
    'codigo_normalizado tem de aparar CR e espaco';
  assert public.codigo_normalizado(null) is null,
    'codigo_normalizado(null) tem de ser nulo: ausencia fecha, e coalesce faria dois nulos colidirem no indice';
  assert public.codigo_normalizado(chr(160)) = '',
    'codigo feito so de NBSP normaliza para vazio — e e por isso que o CHECK usa o normalizador, nao btrim';
  raise notice 'assertiva 1 OK — codigo_normalizado apara os cinco brancos e propaga nulo';

  -- Dado de teste: uma base, um arquivo dela, um chunk, um espaço anexado.
  delete from public.spaces   where slug      like 'zz-t12-%';
  delete from public.ai_bases where base_code like 'zz-t12-%';

  insert into public.ai_bases (base_code, name) values (v_cod, v_cod) returning id into v_base;

  insert into public.knowledge_documents (base_id, storage_path, original_name, status)
    values (v_base, 'zz-t12/a.txt', 'zz-t12-doc.txt', 'ready')
    returning id into v_doc;

  insert into public.chunks (document_id, content)
    values (v_doc, 'Documento de teste zzmarcadortarefa12 pertence a base zz-t12-nbsp.');

  insert into public.spaces (slug, name, type, visibility)
    values ('zz-t12-espaco', 'zz-t12-espaco', 'client', 'private') returning id into v_sp;
  insert into public.ai_base_documentacoes (base_id, space_id, enabled, regra)
    values (v_base, v_sp, true, '{}'::jsonb);

  -- ── 2. As duas funções de busca e o NBSP no `p_base` ────────────────
  -- Com o `btrim` de um argumento, `p_base` com NBSP não casava nenhuma base,
  -- `base_alvo` ficava vazio e a cerca RECUSAVA o documento da própria base:
  -- estas duas assertivas voltariam 0.
  select count(*) into v_n
    from public.hybrid_search_scoped(
      p_query := 'zzmarcadortarefa12',
      p_document_ids := array[v_doc],
      p_limit := 5,
      p_group_limit := 5,
      p_base := v_cod || chr(160)
    );
  assert v_n = 1,
    format('hybrid_search_scoped com NBSP no p_base tem de resolver a MESMA base e devolver 1 linha, veio %s', v_n);

  select count(*) into v_n
    from public.knowledge_list_chunks(
      p_query := 'zzmarcadortarefa12',
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
      p_query := 'zzmarcadortarefa12',
      p_document_ids := array[v_doc],
      p_limit := 5,
      p_group_limit := 5,
      p_base := 'zz-t12-outra-base' || chr(160)
    );
  assert v_n = 0,
    format('hybrid_search_scoped com codigo de OUTRA base tem de recusar (ausencia fecha), veio %s', v_n);
  raise notice 'assertiva 2 OK — as duas funcoes de busca tratam NBSP/TAB no p_base como a mesma base, e outra base continua recusada';

  -- ── 3. As duas RPCs de metadado ─────────────────────────────────────
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
  raise notice 'assertiva 3 OK — documentos_da_base e escopo_documentacao tambem normalizam o p_base';

  -- ── 4. O FURO ENTRE CLIENTES: as duas bases têm de COLIDIR ──────────
  -- Subtransação: sem o bloco interno, a violação abortaria o bloco anônimo
  -- inteiro em vez de ser observada.
  --
  -- (Aqui não se escreve o par de dólares nem dentro de comentário: o dollar
  -- quoting é LEXICAL e ignora comentário, então mencioná-lo fecharia o corpo no
  -- meio — ver 20260925130000, onde isso custou uma aplicação recusada.)
  begin
    insert into public.ai_bases (base_code, name)
      values (v_cod || chr(160), 'zz-t12-nbsp-2');
    v_recusou := false;
  exception when unique_violation then
    v_recusou := true;
  end;
  assert v_recusou,
    'duas bases que diferem apenas por NBSP tem de COLIDIR no indice novo. Elas coexistindo e o furo entre clientes: o indice as trata como distintas e a dimensao `base` de elegivel as trata como a mesma, entao uma documentacao restrita a uma alcanca os usuarios da outra.';

  -- O mesmo para TAB, e caixa/espaço (que o índice antigo já pegava).
  begin
    insert into public.ai_bases (base_code, name) values (chr(9) || v_cod, 'zz-t12-nbsp-3');
    v_recusou := false;
  exception when unique_violation then
    v_recusou := true;
  end;
  assert v_recusou, 'duas bases que diferem apenas por TAB tem de colidir';

  begin
    insert into public.ai_bases (base_code, name) values ('  ZZ-T12-NBSP  ', 'zz-t12-nbsp-4');
    v_recusou := false;
  exception when unique_violation then
    v_recusou := true;
  end;
  assert v_recusou, 'caixa e espaco continuam colidindo (nao perdemos o que o indice antigo pegava)';

  -- E o CHECK: código só de branco deixa de existir.
  begin
    insert into public.ai_bases (base_code, name) values (chr(160), 'zz-t12-branco');
    v_recusou := false;
  exception when check_violation then
    v_recusou := true;
  end;
  assert v_recusou,
    'base_code feito so de NBSP tem de ser recusado pelo CHECK: o normalizado dele e vazio, e um p_base vazio casaria com ele';
  raise notice 'assertiva 4 OK — NBSP, TAB, caixa e espaco colidem, e codigo em branco e recusado';

  -- Limpeza.
  delete from public.spaces   where slug      like 'zz-t12-%';
  delete from public.ai_bases where base_code like 'zz-t12-%';
end $$;

-- ── 5. `anon` consegue CHAMAR as duas funções de busca ────────────────
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
do $$
declare
  v_hss int;
  v_klc int;
begin
  set local role anon;
  select count(*) into v_hss
    from public.hybrid_search_scoped(p_query := 'zzsondaanontarefa12', p_limit := 1);
  select count(*) into v_klc
    from public.knowledge_list_chunks(p_query := 'zzsondaanontarefa12', p_document_ids := '{}'::uuid[]);
  reset role;
  raise notice 'assertiva 5 OK — anon chamou hybrid_search_scoped (% linhas) e knowledge_list_chunks (% linhas) sem erro', v_hss, v_klc;
exception when others then
  reset role;
  raise exception
    'assertiva 5: o papel anon NAO consegue chamar a busca (% / %). A busca publica do portal usa a chave anon (src/app/(portal)/actions.ts:141) e engole o erro como lista vazia. Causa provavel: alguma tabela sem grant para anon voltou para a range table de uma das duas funcoes, que sao security invoker — a base alvo tem de vir de public.bases_do_codigo, que e security definer.',
    sqlstate, sqlerrm;
end $$;

-- ── 6. Estado de grant dos três papéis ───────────────────────────────
-- `has_function_privilege('anon', ...)` responde verdadeiro quando é PUBLIC que
-- tem o privilégio, então negar `anon` também prova que PUBLIC não tem.
do $$
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

  -- regra_valida: fora de PUBLIC/anon, mantida para quem grava.
  assert not has_function_privilege('anon', 'public.regra_valida(jsonb)', 'execute'),
    'regra_valida nao pode mais ter EXECUTE para anon nem para PUBLIC';
  assert has_function_privilege('authenticated', 'public.regra_valida(jsonb)', 'execute'),
    'regra_valida TEM de continuar executavel por authenticated: o CHECK das tres tabelas e avaliado como quem grava';
  assert has_function_privilege('service_role', 'public.regra_valida(jsonb)', 'execute'),
    'regra_valida tem de continuar executavel por service_role';

  -- codigo_normalizado: fora de PUBLIC/anon; authenticated precisa para gravar
  -- em ai_bases (CHECK e expressao de indice sao avaliados como quem grava).
  assert not has_function_privilege('anon', 'public.codigo_normalizado(text)', 'execute'),
    'codigo_normalizado nao precisa de anon: as duas funcoes de busca a alcancam por bases_do_codigo, que e definer';
  assert has_function_privilege('authenticated', 'public.codigo_normalizado(text)', 'execute'),
    'codigo_normalizado TEM de ser executavel por authenticated, senao gravar base pelo admin quebra no CHECK e no indice';
  assert has_function_privilege('service_role', 'public.codigo_normalizado(text)', 'execute'),
    'codigo_normalizado tem de ser executavel por service_role';

  -- bases_do_codigo: anon PRECISA, e o motivo esta na assertiva 5.
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

  raise notice 'assertiva 6 OK — grants dos tres papeis conferidos nas cinco funcoes';
end $$;
