-- =====================================================================
-- A LISTA DAS DOZE DIMENSÕES GANHA UMA FONTE, PARA A PARIDADE SER REAL
--
-- `elegivel` trazia os doze nomes num array literal dentro do corpo, e
-- `src/lib/elegibilidade/dimensoes.ts` traz os mesmos doze. Eu havia
-- escrito que o corpus compartilhado cobria essa duplicação; a revisão
-- da tarefa 4b mostrou que não: o script de paridade compara os casos
-- que existem, e uma décima terceira dimensão acrescentada só de um lado
-- não faz nenhum caso falhar.
--
-- Expondo a lista como função, o script compara as DUAS LISTAS, não só o
-- comportamento em casos já escritos. A divergência passa a ser
-- impossível de passar batida em vez de improvável.
--
-- =====================================================================
-- SÍTIO ÚNICO DE DEFINIÇÃO DE public.elegivel(jsonb, jsonb) (tarefa 16)
--
-- ESTE arquivo é o único sítio de definição de duas funções:
--
--   · public.dimensoes_elegibilidade()
--   · public.elegivel(jsonb, jsonb)
--
-- Definir `elegivel` em OUTRO arquivo é o defeito que esta migration fechou.
-- `npm run verificar:corpo` recusa o segundo sítio.
--
-- ── O defeito que isto encerra ────────────────────────────────────────
-- Não há ledger de migrations, então reaplicar um arquivo à mão é operação
-- NORMAL aqui. `elegivel` estava definida em QUATRO arquivos, e reaplicar o
-- mais antigo desfazia o mais novo em SILÊNCIO: a assinatura continua única,
-- então `npm run verificar:rpc` passa e nenhuma assertiva de assinatura
-- percebe. É o CORPO que retrocede — e este corpo é o que decide, para todo o
-- produto, qual cliente alcança qual documentação.
--
-- Antes desta consolidação, reaplicar sozinho:
--
--   · `20260924231000` devolvia o motor de SEIS dimensões implícitas: o corpo
--     de lá aceita QUALQUER chave como dimensão, então `{"foo":["x"]}` com
--     identidade `{"foo":"x"}` LIBERAVA, e um typo de dimensão
--     (`centro_custos` no plural) abria o conteúdo em vez de fechá-lo;
--   · `20260924233000` devolvia a lista das doze como array literal dentro do
--     corpo, desfazendo a fonte única que `npm run verificar:elegibilidade`
--     usa para comparar as duas listas — a divergência entre SQL e TypeScript
--     voltava a ser invisível;
--   · as duas devolviam a REGRA INTEIRA malformada ao comportamento de
--     LEVANTAR EXCEÇÃO (`regra = 7` virava erro de SQL, e o erro numa RPC de
--     listagem é um 500 onde devia haver negação);
--   · `20260925010000` era o corpo vivo, mas com ele definido em quatro
--     lugares qualquer um dos três acima ganhava a última palavra.
--
-- ── O método, que é o que faz disto um no-op VERIFICADO ───────────────
-- O corpo de `elegivel` abaixo NÃO foi remontado à mão a partir dos quatro
-- arquivos: é a saída de `pg_get_functiondef` do banco de PRODUÇÃO colada
-- aqui. Daí o cabeçalho em MAIÚSCULAS e a forma `IMMUTABLE PARALLEL SAFE`:
-- é o texto que o banco devolve, não o que um arquivo antigo dizia.
--
-- O SHA-256 de `pg_get_functiondef('public.elegivel(jsonb,jsonb)')` foi
-- capturado ANTES de escrever este arquivo e conferido DEPOIS de aplicá-lo:
-- tem de ser IDÊNTICO. Os digestos estão no relatório da tarefa 16.
--
-- ── Por que o sítio canônico é ESTE arquivo, e não um mais novo ───────
-- O corpo vivo chama `public.dimensoes_elegibilidade()`, criada AQUI, e
-- `check_function_bodies` está ligado neste banco (medido): criar uma função
-- SQL cujo corpo chama função inexistente FALHA. Então o sítio canônico não
-- pode ser anterior a este arquivo.
--
-- E não pode ser POSTERIOR a `20260926120000_funcoes_de_escopo_canonicas.sql`,
-- que cria `escopo_documentacao` e `documentos_da_base` — as duas CHAMAM
-- `elegivel` no corpo. Um arquivo canônico mais novo faria uma aplicação do
-- zero falhar ali com `function public.elegivel(jsonb, jsonb) does not exist`.
--
-- Dentro da janela que sobra, este arquivo é o PRIMEIRO ponto legal, e isso é
-- escolha deliberada: assim TODO arquivo posterior — inclusive as 34
-- assertivas de `20260925010000` — roda contra o corpo canônico e vira prova
-- de replay, em vez de precisar ser transplantado para cá.
--
-- Nenhum índice, CHECK, coluna gerada ou policy depende de `elegivel`
-- (conferido em `pg_depend` e por varredura de `pg_get_indexdef`,
-- `pg_get_constraintdef`, `pg_get_expr` de policy e `pg_get_viewdef`). Os três
-- CHECKs de regra dependem de `public.regra_valida(jsonb)`, que chama
-- `dimensoes_elegibilidade()` e NÃO `elegivel`; `regra_valida` nasce em
-- `20260925100000`, depois deste arquivo.
--
-- ── De onde veio cada bloco ──────────────────────────────────────────
--   corpo de `elegivel` ............ de pg_get_functiondef (corpo de
--                                    20260925010000, que era o vivo)
--   `comment on function` dela ..... de 20260925010000
--   `revoke`/`grant` dela .......... de 20260924231000 e 20260924233000
--   assertivas ..................... de 20260924231000 e 20260924233000
--
-- As assertivas vieram JUNTO com a definição de propósito: elas CHAMAM
-- `elegivel`, e numa aplicação do zero rodariam antes de a função existir se
-- ficassem nos arquivos antigos. O mesmo valia para os `revoke`/`grant`, que
-- em `20260924231000` passariam a apontar para função inexistente.
--
-- `20260925010000` guarda as assertivas dele onde estão: ele roda DEPOIS deste
-- arquivo, então a função já existe. Cada arquivo antigo diz no cabeçalho o
-- que saiu e para onde foi.
--
-- ── `create or replace`, e `drop function` PROIBIDO aqui ─────────────
-- A assinatura não muda. `drop function` + `create` devolveria EXECUTE a
-- PUBLIC (portanto a `anon`) numa função de autorização. Os privilégios são
-- restatados abaixo de propósito: o `replace` preserva o ACL, mas o arquivo
-- tem de ser auto-suficiente e re-rodável, porque não há ledger.
-- =====================================================================

create or replace function public.dimensoes_elegibilidade()
returns text[]
language sql
immutable parallel safe
as $$
  select array[
    'base','portal','perfil','usuario','empresa','matricula',
    'filial','centro_custo','unidade_adm','unidade_negocio',
    'vinculo','sindicato'
  ];
$$;

comment on function public.dimensoes_elegibilidade() is
  'As doze dimensões de elegibilidade, na ordem da especificação. Fonte única do lado do banco; npm run verificar:elegibilidade compara esta lista com DIMENSOES de src/lib/elegibilidade/dimensoes.ts e falha se divergirem.';

revoke all on function public.dimensoes_elegibilidade() from public, anon;
grant execute on function public.dimensoes_elegibilidade() to authenticated, service_role;

-- ── public.elegivel — corpo VIVO, colado de pg_get_functiondef ───────
-- Não edite este bloco em outro arquivo. Se precisar mudar o motor de
-- elegibilidade, mude AQUI, meça com `npm run verificar:elegibilidade` (51
-- casos, gêmea em src/lib/elegibilidade/alcanca.ts) e declare o digesto novo
-- de propósito no relatório.
CREATE OR REPLACE FUNCTION public.elegivel(regra jsonb, identidade jsonb)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE
AS $function$
  with bruta as (
    -- SQL NULL e o jsonb `null` caem no MESMO caso: "sem regra".
    select coalesce(regra, 'null'::jsonb) as v
  ),
  pronta as (
    select jsonb_typeof(v) as tipo,
           -- O jsonb_each abaixo recebe SEMPRE um objeto, por construção.
           case when jsonb_typeof(v) = 'object' then v else '{}'::jsonb end as obj
      from bruta
  )
  select p.tipo in ('object', 'null')   -- regra que não é objeto: FECHA
     and not exists (
       select 1
         from jsonb_each(p.obj) r(dim, lista)
        -- `null` é dimensão NÃO CONFIGURADA, e não restrição vazia.
        where jsonb_typeof(r.lista) <> 'null'
          and (
               -- CHAVE QUE NÃO É UMA DAS DOZE: regra malformada, FECHA.
               r.dim <> all (public.dimensoes_elegibilidade())
               -- VALOR MALFORMADO FECHA, inclusive quando a identidade casaria.
            or jsonb_typeof(r.lista) <> 'array'
            or not public.allowlist_casa(
                 (select array_agg(x #>> '{}') from jsonb_array_elements(r.lista) x),
                 identidade #>> array[r.dim]
               )
          )
     )
    from pronta p;
$function$;

comment on function public.elegivel(jsonb, jsonb) is
  'Alcance de uma regra de elegibilidade sobre uma identidade, nas doze dimensões. Dentro da dimensão OU, entre dimensões E, lower(btrim()) dos dois lados, lista vazia libera, valor AUSENTE contra dimensão restrita FECHA. Valor `null` = dimensão não configurada (libera). FECHA em valor que não é lista, em chave que não é uma das doze e na REGRA INTEIRA que não é objeto — sempre fechando, nunca levantando exceção, porque autorização que estoura devolve 500 onde devia devolver negação. Regra ausente (SQL NULL ou jsonb null) = sem regra, LIBERA. Quem recusa a regra malformada antes de ela ser gravada é chavesProblematicasDaRegra, no caminho de gravação. Gêmea de src/lib/elegibilidade/alcanca.ts; npm run verificar:elegibilidade prova que concordam.';

revoke all on function public.elegivel(jsonb, jsonb) from public, anon;
grant execute on function public.elegivel(jsonb, jsonb) to authenticated, service_role;

-- ── Assertivas desta migration ──────────────────────────────────────
do $$
begin
  assert cardinality(public.dimensoes_elegibilidade()) = 12,
    'sao doze dimensoes';
  -- Parênteses ao redor da chamada são obrigatórios: o Postgres não aceita
  -- indexar o retorno de uma função diretamente (`fn()[1]` é erro de sintaxe),
  -- só uma expressão já parenteseada (`(fn())[1]`).
  assert (public.dimensoes_elegibilidade())[1] = 'base',
    'a ordem da especificacao comeca em base';
  assert (public.dimensoes_elegibilidade())[12] = 'sindicato',
    'e termina em sindicato';
  -- O comportamento de `elegivel` NÃO pode mudar por causa da refatoração.
  assert not public.elegivel('{"dimensao_inexistente":["x"]}', '{"dimensao_inexistente":"x"}'),
    'chave desconhecida continua fechando';
  assert public.elegivel('{"portal":["PG"]}', '{"portal":"pg"}'),
    'array bem formado que casa continua liberando';
  assert not public.elegivel('{"portal":["PG"]}', '{}'),
    'ausencia continua fechando';
  assert not public.elegivel('{"portal":"PG"}', '{"portal":"PG"}'),
    'valor malformado continua fechando';
  assert public.elegivel('{"portal":null}', '{}'),
    'null continua liberando';
  assert public.elegivel('{"portal":[]}', '{}'),
    'array vazio continua liberando';
end $$;

-- ── Assertivas que vieram de 20260924231000 (tarefa 16) ─────────────
-- Elas CHAMAM `elegivel`; ficando lá, uma aplicação do zero as rodaria antes
-- de a função existir.
do $$
begin
  assert public.elegivel('{}'::jsonb, '{}'::jsonb),
    'regra vazia libera';
  assert public.elegivel('{"portal":["PG"]}', '{"portal":"pg"}'),
    'caixa nao importa';
  assert not public.elegivel('{"portal":["PG"]}', '{}'::jsonb),
    'ausencia fecha';
  assert not public.elegivel('{"portal":["","PG"]}', '{}'::jsonb),
    'branco na lista nao libera ausencia';
  assert public.elegivel('{"portal":["",""]}', '{}'::jsonb),
    'lista so de brancos libera';
  assert not public.elegivel('{"portal":["PG"],"perfil":["FOLHA"]}', '{"portal":"PG","perfil":"RH"}'),
    'E entre dimensoes';
  assert not public.elegivel('{"centro_custo":["100"]}', '{"centro_custo":"0100"}'),
    'zero a esquerda nao casa';
  assert not public.elegivel('{"portal":"PG"}', '{}'),
    'regra com string em vez de array FECHA';
  assert not public.elegivel('{"portal":123}', '{}'),
    'regra com numero FECHA';
  assert not public.elegivel('{"portal":{"a":1}}', '{}'),
    'regra com objeto FECHA';
  assert not public.elegivel('{"portal":"PG"}', '{"portal":"PG"}'),
    'regra malformada FECHA mesmo com identidade casando';
  assert public.elegivel('{"portal":null}', '{}'),
    'null = dimensao nao configurada, LIBERA';
  assert public.elegivel('{"portal":[]}', '{}'),
    'array vazio LIBERA';
end $$;

-- ── Assertivas que vieram de 20260924233000 (tarefa 16) ─────────────
do $$
begin
  -- O que aquela migration corrigia
  assert not public.elegivel('{"dimensao_inexistente":["x"]}', '{"dimensao_inexistente":"x"}'),
    'chave desconhecida FECHA mesmo quando a identidade casaria';
  assert not public.elegivel('{"dimensao_inexistente":["x"]}', '{}'),
    'chave desconhecida FECHA sem identidade';
  assert not public.elegivel('{"centro_custos":["100"]}', '{"centro_custo":"100"}'),
    'typo no nome da dimensao FECHA';
  assert public.elegivel('{"foo":null}', '{}'),
    'chave desconhecida com null e ignorada, como nas conhecidas';

  -- O que NÃO pode ter mudado
  assert public.elegivel('{}'::jsonb, '{}'::jsonb),
    'regra vazia libera';
  assert public.elegivel('{"portal":["PG"]}', '{"portal":"pg"}'),
    'array bem formado que casa continua liberando';
  assert not public.elegivel('{"portal":["PG"]}', '{}'),
    'ausencia contra dimensao restrita continua fechando';
  assert public.elegivel('{"portal":[]}', '{}'),
    'array vazio continua liberando';
  assert public.elegivel('{"portal":null}', '{}'),
    'null continua liberando';
  assert not public.elegivel('{"portal":"PG"}', '{}'),
    'valor malformado continua fechando';
  assert not public.elegivel('{"portal":"PG"}', '{"portal":"PG"}'),
    'valor malformado continua fechando mesmo casando';
  assert not public.elegivel('{"portal":["PG"],"perfil":["FOLHA"]}', '{"portal":"PG","perfil":"RH"}'),
    'E entre dimensoes continua valendo';
  assert not public.elegivel('{"centro_custo":["100"]}', '{"centro_custo":"0100"}'),
    'zero a esquerda continua nao casando';
  -- Todas as doze continuam sendo aceitas como dimensão conhecida
  assert public.elegivel('{"base":["b"],"portal":["p"],"perfil":["pe"],"usuario":["u"],"empresa":["e"],"matricula":["m"],"filial":["f"],"centro_custo":["c"],"unidade_adm":["ua"],"unidade_negocio":["un"],"vinculo":["v"],"sindicato":["s"]}',
    '{"base":"b","portal":"p","perfil":"pe","usuario":"u","empresa":"e","matricula":"m","filial":"f","centro_custo":"c","unidade_adm":"ua","unidade_negocio":"un","vinculo":"v","sindicato":"s"}'),
    'as doze dimensoes continuam conhecidas';
end $$;
