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

-- `elegivel` passa a ler a lista em vez de repeti-la.
create or replace function public.elegivel(regra jsonb, identidade jsonb)
returns boolean
language sql
immutable parallel safe
as $$
  select not exists (
    select 1
      from jsonb_each(coalesce(regra, '{}'::jsonb)) r(dim, lista)
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
  );
$$;

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
