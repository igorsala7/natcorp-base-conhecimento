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
-- que fixa os três papéis com `has_function_privilege` viajou com as funções
-- para `20260926120000_funcoes_de_escopo_canonicas.sql` (tarefa 15), porque
-- `has_function_privilege` de função que não existe levanta erro — e
-- `has_function_privilege('anon', ...)` responde verdadeiro quando
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
-- que ele alcança, não verifica se ele consegue CHAMAR a busca. A assertiva que
-- assume o papel `anon` e chama as duas funções nasceu aqui e hoje mora em
-- `20260926120000_funcoes_de_escopo_canonicas.sql`, com elas (tarefa 15);
-- qualquer mudança futura que volte a pôr uma tabela fechada ao `anon` no plano
-- delas para nela, em vez de virar busca vazia em produção.
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
-- ── `create or replace`, e `drop` PROIBIDO aqui ───────────────────────
-- Nenhuma assinatura muda. `drop function` + `create` devolveria EXECUTE a
-- PUBLIC e desfaria justamente os revokes que este ramo passou a rodada
-- fechando. É a situação oposta à da 20260925120000, onde a assinatura ganhou
-- parâmetro e o drop era obrigatório. Valia para as cinco funções que este
-- arquivo criava e continua valendo para a que ficou.
--
-- ── O QUE SAIU DESTE ARQUIVO, E PARA ONDE FOI (tarefa 15) ─────────────
-- As definições de `public.bases_do_codigo`, `public.escopo_documentacao`,
-- `public.documentos_da_base`, `public.hybrid_search_scoped` e
-- `public.knowledge_list_chunks` — com os `comment on function`, os
-- `revoke`/`grant` e as assertivas que CHAMAM essas funções — saíram daqui e
-- passaram a morar num sítio ÚNICO:
--
--   supabase/migrations/20260926120000_funcoes_de_escopo_canonicas.sql
--
-- Enquanto elas estavam definidas aqui TAMBÉM, reaplicar este arquivo sozinho
-- — operação normal, porque não há ledger — desfazia em SILÊNCIO o
-- `k.status = 'ready'` que a `20260926100000` acrescentou a
-- `documentos_da_base`, devolvendo ao RAG arquivo em extração, com chunks pela
-- metade que o modelo afirma como o todo. A assinatura não mudava, então nem
-- `npm run verificar:rpc` nem assertiva de assinatura nenhuma percebia: era o
-- CORPO que retrocedia. Agora `npm run verificar:corpo` recusa o segundo sítio.
--
-- ── `codigo_normalizado` FICOU AQUI, e é decisão de ORDEM ──────────────
-- O plano da tarefa 15 mandava levá-la para o arquivo canônico junto com
-- `bases_do_codigo`. Ela ficou, porque este MESMO arquivo cria dois objetos de
-- schema SOBRE a expressão dela:
--
--   · o índice único `ai_bases_codigo_normalizado_key`, em
--     `public.codigo_normalizado(base_code)`;
--   · o CHECK `ai_bases_codigo_nao_branco`, na mesma chamada.
--
-- Levar a função para um arquivo POSTERIOR faria uma aplicação do zero deste
-- arquivo falhar com `function public.codigo_normalizado(text) does not exist`
-- — trocaríamos um defeito silencioso por um erro duro na replay, que é pior
-- negócio. E ela nunca foi parte do problema: tem UM sítio de definição (este),
-- e reaplicar este arquivo sozinho a recria IDÊNTICA.
--
-- Quem quiser levá-la ao arquivo canônico tem de levar JUNTO o bloco de
-- colisão, o índice único e o CHECK. Isso é mudança de dono de objeto de
-- schema, não transposição de função, e é decisão do dono.
--
-- As assertivas do APARO (a 1) e da COLISÃO no índice (a 4) ficaram aqui, com a
-- função e o índice que elas exercitam. As que chamam as cinco funções que
-- saíram viajaram com elas.
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
-- ASSERTIVAS — comportamentais, e cada uma falha por um motivo diferente
--
-- Molde das migrations 120000/140000: dado com prefixo `zz-`, limpeza defensiva
-- na entrada e limpeza explícita na saída. Não há `rollback` dentro de bloco
-- anônimo; o que garante que nada sobrevive a uma falha é
-- `scripts/apply-migrations.ts`, que envolve o arquivo em begin/commit.
--
--   1. aparo de cinco caracteres em `codigo_normalizado`, incluindo NBSP
--   4. duas bases que diferem por NBSP COLIDEM (o furo entre clientes)
--
-- A numeração tem buracos de propósito. As assertivas 2, 3, 5 e 6 desta
-- migration CHAMAM as cinco funções que saíram na tarefa 15, então viajaram
-- com elas para
-- `20260926120000_funcoes_de_escopo_canonicas.sql` — numa aplicação do zero
-- elas rodariam antes de a função existir se tivessem ficado aqui. Renumerar as
-- que ficaram faria as duas metades deixarem de se referenciar.
-- =====================================================================
do $aparo$
declare
  v_cod      text := 'zz-t12-nbsp';
  v_recusou  boolean;
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

  -- Dado de teste da assertiva 4: uma base, para as inserções colidentes
  -- abaixo terem com quem colidir.
  delete from public.ai_bases where base_code like 'zz-t12-%';

  insert into public.ai_bases (base_code, name) values (v_cod, v_cod);

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
  delete from public.ai_bases where base_code like 'zz-t12-%';
end $aparo$;

-- ── 6. Estado de grant das duas funções que ficaram ──────────────────
-- `has_function_privilege('anon', ...)` responde verdadeiro quando é PUBLIC que
-- tem o privilégio, então negar `anon` também prova que PUBLIC não tem.
--
-- Os grants das cinco funções que saíram são conferidos no arquivo canônico,
-- junto com elas.
do $grants$
begin
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

  raise notice 'assertiva 6 OK — grants de codigo_normalizado e regra_valida conferidos';
end $grants$;
