-- =====================================================================
-- CHAVE QUE NÃO É DIMENSÃO PASSA A FECHAR
--
-- `elegivel` itera `jsonb_each(regra)` e trata qualquer chave como
-- dimensão. Medido em produção antes desta migration:
--
--   elegivel('{"dimensao_inexistente":["x"]}', '{}')                           -> false
--   elegivel('{"dimensao_inexistente":["x"]}', '{"dimensao_inexistente":"x"}') -> TRUE
--
-- O segundo caso abre. Ele não acontece hoje, porque a identidade é
-- montada a partir das doze chaves conhecidas e nunca carrega chave
-- estranha — mas "não acontece hoje" não é uma garantia, e este é o
-- ponto único que as RPCs dos projetos 1 a 3 vão chamar.
--
-- O motivo mais forte é o gêmeo: o predicado em TypeScript iterava a
-- lista fixa de dimensões e IGNORAVA chave desconhecida. Ignorar abre
-- sempre, inclusive no caso que mais vai acontecer, que é typo no nome
-- da dimensão (`centro_custos` no plural). Os dois lados fechando por
-- construção é o que torna a paridade verificável em vez de casual.
--
-- A lista das doze mora aqui e em src/lib/elegibilidade/dimensoes.ts. A
-- duplicação é real e é coberta pelo corpus compartilhado, que tem caso
-- de chave desconhecida: se alguém acrescentar uma dimensão em um lado
-- só, `npm run verificar:elegibilidade` acusa.
-- =====================================================================

create or replace function public.elegivel(regra jsonb, identidade jsonb)
returns boolean
language sql
immutable parallel safe
as $$
  select not exists (
    select 1
      from jsonb_each(coalesce(regra, '{}'::jsonb)) r(dim, lista)
     -- `null` é dimensão NÃO CONFIGURADA, e não restrição vazia: mesma
     -- leitura que `allowlist_casa(null, x)` já faz. Vale também para
     -- chave desconhecida com valor null, para os dois lados concordarem.
     where jsonb_typeof(r.lista) <> 'null'
       and (
            -- CHAVE QUE NÃO É UMA DAS DOZE: regra malformada, FECHA,
            -- independentemente do que a identidade traga.
            r.dim <> all (array[
              'base','portal','perfil','usuario','empresa','matricula',
              'filial','centro_custo','unidade_adm','unidade_negocio',
              'vinculo','sindicato'
            ])
            -- VALOR MALFORMADO FECHA. Pular a dimensão quando o valor não
            -- era lista abria: {"portal":"PG"} em vez de {"portal":["PG"]}
            -- liberava para todo mundo. Fecha mesmo quando a identidade
            -- casaria: não se adivinha intenção de dado malformado.
         or jsonb_typeof(r.lista) <> 'array'
         or not public.allowlist_casa(
              (select array_agg(x #>> '{}') from jsonb_array_elements(r.lista) x),
              identidade #>> array[r.dim]
            )
       )
  );
$$;

comment on function public.elegivel(jsonb, jsonb) is
  'Alcance de uma regra de elegibilidade sobre uma identidade, nas doze dimensões. Dentro da dimensão OU, entre dimensões E, lower(btrim()) dos dois lados, lista vazia libera, valor AUSENTE contra dimensão restrita FECHA. Valor `null` = dimensão não configurada (libera). FECHA em valor que não é lista e em chave que não é uma das doze dimensões, mesmo quando a identidade casaria. Gêmea de src/lib/elegibilidade/alcanca.ts; npm run verificar:elegibilidade prova que concordam.';

revoke all on function public.elegivel(jsonb, jsonb) from public, anon;
grant execute on function public.elegivel(jsonb, jsonb) to authenticated, service_role;

-- ── Assertivas ──────────────────────────────────────────────────────
do $$
begin
  -- O que esta migration corrige
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
