-- =====================================================================
-- OS GÊMEOS DIVERGIAM EM DUAS COISAS QUE O CORPUS NÃO COBRIA
--
-- A regra de elegibilidade é escrita duas vezes de propósito: em SQL,
-- porque o corte tem de acontecer no banco (widget.js é público), e em
-- TypeScript, porque a tela mostra a frase enquanto o admin digita. A
-- dívida disso é que as duas podem discordar, e o corpus compartilhado
-- (src/lib/elegibilidade/casos.json) é o que impede. Ele não cobria
-- estes dois grupos, e medido em 24/09 os dois lados discordavam:
--
--   entrada                          public.elegivel   alcanca (TS)
--   regra = null                     true              DERRUBAVA
--   regra = 7                        ERRO de SQL       true -- ABRIA
--   regra = ["PG"]                   ERRO de SQL       false
--   identidade E'\tPG' x ['PG']      false             true
--   identidade NBSP+'PG' x ['PG']    false             true
--
-- Cinco casos novos no corpus fixam a decisão; esta migration põe o
-- lado SQL em cima dela.
--
-- ── (a) REGRA INTEIRA MALFORMADA ────────────────────────────────────
-- Decisão do dono: `null` é "sem regra" e NÃO restringe (é o
-- `coalesce(regra,'{}')` que a função já fazia); qualquer outra coisa
-- que não seja objeto — número, texto, array — é regra malformada e
-- FECHA, dos dois lados.
--
-- Do lado SQL isso deixa de ser ERRO e passa a ser negação, porque
-- função de autorização que levanta exceção em entrada ruim devolve 500
-- onde devia devolver "não pode". Um 500 numa RPC de listagem esconde a
-- causa e, pior, convida quem for consertar a tratar a exceção no
-- chamador — cada chamador do seu jeito.
--
-- CUIDADO com `jsonb` null: `regra` pode chegar como SQL NULL (sem
-- valor) ou como o jsonb `'null'` (o script de paridade manda
-- JSON.stringify(null), que é o texto "null"). As duas querem dizer a
-- mesma coisa e as duas têm de LIBERAR. Por isso o coalesce usa
-- `'null'::jsonb`, e não `'{}'`: assim os dois caminhos caem no MESMO
-- teste, em vez de um deles virar objeto vazio por acidente.
--
-- O `jsonb_each` recebe sempre um OBJETO, por construção. Escrever
-- `case when tipo = 'object' then not exists (select ... jsonb_each(regra))`
-- dependeria de o Postgres não avaliar o braço não escolhido do CASE —
-- que é verdade na prática e não é garantia escrita. Numa função de
-- autorização, saneia-se a entrada do `jsonb_each` e não se discute
-- ordem de avaliação.
--
-- ── (b) APARO: `btrim()` sem segundo argumento só tira ESPAÇO ────────
-- `.trim()` do JavaScript remove tabulação, nova linha e NBSP; o
-- `btrim(x)` do Postgres remove só o caractere espaço. Então uma
-- identidade que chegasse com tabulação na frente casava na tela e não
-- casava no banco: a tela prometia um alcance que o banco não entrega,
-- e é justamente o modo de falha que o script de paridade existe para
-- pegar.
--
-- Alargamos o lado SQL para o conjunto que o JS remove nas duas pontas,
-- e não o contrário, porque quem normaliza na ENTRADA é o JS
-- (`trackingFields`): estreitar o JS mudaria o que fica gravado.
--
-- O conjunto é montado com `chr()` e não com E'... ': caractere
-- invisível dentro de arquivo-fonte atravessa revisão sem ninguém ver, e
-- basta um editor trocá-lo por espaço para a correção virar nada (neste
-- repositório dois bytes NUL num fonte já esconderam uma colisão). Com
-- `chr(160)` a linha diz o que ela faz.
--
-- As duas funções são trocadas por `create or replace`, de propósito:
-- `drop` + `create` devolveria EXECUTE para PUBLIC e desfaria em
-- silêncio o `revoke` das migrations anteriores — é o defeito que existe
-- hoje em `20260924232000`. Não há `grant` nenhum aqui porque o
-- `replace` preserva o ACL que já está no banco.
--
-- Fica DENTRO de `allowlist_casa`, que é o lugar único por onde passam
-- tanto os itens da lista quanto o valor — `elegivel` herda.
--
-- Residual conhecido, e escrito para o dono decidir se vale: o JS
-- também remove tabulação vertical (U+000B), form feed (U+000C) e os
-- espaços Unicode exóticos (U+2000–U+200A, U+3000, BOM). Estes cinco
-- caracteres são os que o dono mandou alinhar, e são os únicos que
-- apareceriam num p_* do ERP. Os dois lados seguem discordando nos
-- exóticos, na direção segura (o banco FECHA), e um caso no corpus
-- pega isso no dia em que importar.
-- =====================================================================

-- ── (b) aparo alinhado com o .trim() do JavaScript ──────────────────
create or replace function public.allowlist_casa(lista text[], valor text)
returns boolean
language sql
immutable parallel safe
as $$
  -- O conjunto de "branco" aparece UMA vez e é usado nas três pontas
  -- (item, teste de item vazio, valor). Repetir o literal três vezes era
  -- convidar a corrigir duas e esquecer a terceira, que é exatamente a
  -- classe de defeito que esta migration está fechando.
  with b(brancos) as (
    select ' ' || chr(9) || chr(10) || chr(13) || chr(160)  -- espaco, TAB, LF, CR, NBSP
  ),
  itens as (
    select lower(btrim(x, b.brancos)) as v
      from b, unnest(coalesce(lista, '{}'::text[])) x
     where btrim(coalesce(x, ''), b.brancos) <> ''
  )
  select not exists (select 1 from itens)
      or lower(btrim(coalesce(valor, ''), b.brancos)) in (select v from itens)
    from b;
$$;

comment on function public.allowlist_casa(text[], text) is
  'Allowlist: lista vazia (ou só de brancos) não restringe; senão compara por lower(btrim()) dos dois lados, e valor AUSENTE nunca casa. Brancos são filtrados antes de decidir — sem isso, uma entrada em branco liberava quem não manda o parâmetro. "Branco" aqui é espaço, TAB, LF, CR e NBSP, o mesmo conjunto que o .trim() do JavaScript remove, para o gêmeo em src/lib/elegibilidade/alcanca.ts não discordar.';

-- ── (a) regra inteira malformada FECHA, em vez de levantar exceção ──
create or replace function public.elegivel(regra jsonb, identidade jsonb)
returns boolean
language sql
immutable parallel safe
as $$
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
$$;

comment on function public.elegivel(jsonb, jsonb) is
  'Alcance de uma regra de elegibilidade sobre uma identidade, nas doze dimensões. Dentro da dimensão OU, entre dimensões E, lower(btrim()) dos dois lados, lista vazia libera, valor AUSENTE contra dimensão restrita FECHA. Valor `null` = dimensão não configurada (libera). FECHA em valor que não é lista, em chave que não é uma das doze e na REGRA INTEIRA que não é objeto — sempre fechando, nunca levantando exceção, porque autorização que estoura devolve 500 onde devia devolver negação. Regra ausente (SQL NULL ou jsonb null) = sem regra, LIBERA. Quem recusa a regra malformada antes de ela ser gravada é chavesProblematicasDaRegra, no caminho de gravação. Gêmea de src/lib/elegibilidade/alcanca.ts; npm run verificar:elegibilidade prova que concordam.';

-- ── Assertivas ──────────────────────────────────────────────────────
do $$
begin
  -- (a) O QUE ESTA MIGRATION CORRIGE: regra inteira malformada
  assert public.elegivel(null, '{"portal":"PG"}'),
    'regra SQL NULL e sem regra: LIBERA';
  assert public.elegivel('null'::jsonb, '{"portal":"PG"}'),
    'regra jsonb null e sem regra: LIBERA (e o script de paridade manda ESTE)';
  assert not public.elegivel('7'::jsonb, '{"portal":"PG"}'),
    'regra escalar FECHA (antes: erro de SQL)';
  assert not public.elegivel('"PG"'::jsonb, '{"portal":"PG"}'),
    'regra texto FECHA (antes: erro de SQL)';
  assert not public.elegivel('["PG"]'::jsonb, '{"portal":"PG"}'),
    'regra em array FECHA (antes: erro de SQL)';
  assert not public.elegivel('true'::jsonb, '{}'::jsonb),
    'regra booleana FECHA';

  -- (b) O QUE ESTA MIGRATION CORRIGE: aparo alem do espaco
  assert public.allowlist_casa(array['PG'], chr(9) || 'PG'),
    'TAB na frente do valor nao pode mais fechar';
  assert public.allowlist_casa(array['PG'], chr(160) || 'PG'),
    'NBSP na frente do valor nao pode mais fechar';
  assert public.allowlist_casa(array['PG'], 'PG' || chr(10)),
    'LF no fim do valor nao pode mais fechar';
  assert public.allowlist_casa(array[chr(9) || 'PG'], 'PG'),
    'TAB no ITEM da lista tambem e aparado';
  assert public.allowlist_casa(array[chr(160), '  '], null),
    'lista de NBSP e espaco e lista de brancos: LIBERA';
  assert not public.allowlist_casa(array[chr(160), 'PG'], null),
    'NBSP + valor real: ausencia continua NAO passando';
  assert public.elegivel('{"portal":["PG"]}', jsonb_build_object('portal', chr(9) || 'PG')),
    'elegivel herda o aparo de allowlist_casa (TAB)';
  assert public.elegivel('{"portal":["PG"]}', jsonb_build_object('portal', chr(160) || 'PG')),
    'elegivel herda o aparo de allowlist_casa (NBSP)';

  -- ── O QUE NAO PODE TER MUDADO ─────────────────────────────────────
  -- allowlist_casa
  assert public.allowlist_casa(null, null),                        'lista nula libera';
  assert public.allowlist_casa('{}'::text[], null),                'lista vazia libera';
  assert public.allowlist_casa(array['', '  '], null),             'lista so de brancos libera';
  assert public.allowlist_casa(array['PG'], 'PG'),                 'valor casa';
  assert public.allowlist_casa(array['pg'], ' PG '),               'caixa e espaco casam';
  assert not public.allowlist_casa(array['PG'], 'PC'),             'valor errado fecha';
  assert not public.allowlist_casa(array['PG'], null),             'ausencia fecha';
  assert not public.allowlist_casa(array['PG'], ''),               'vazio fecha';
  assert not public.allowlist_casa(array['', 'PG'], null),         'branco + valor: ausencia NAO passa';
  assert not public.allowlist_casa(array['  ', 'PG'], ''),         'espaco + valor: vazio NAO passa';
  -- elegivel
  assert public.elegivel('{}'::jsonb, '{}'::jsonb),
    'regra vazia libera';
  assert public.elegivel('{"portal":["PG"]}', '{"portal":"pg"}'),
    'array bem formado que casa continua liberando';
  assert not public.elegivel('{"portal":["PG"]}', '{}'),
    'ausencia contra dimensao restrita continua fechando';
  assert public.elegivel('{"portal":[]}', '{}'),
    'array vazio continua liberando';
  assert public.elegivel('{"portal":null}', '{}'),
    'null na dimensao continua liberando';
  assert not public.elegivel('{"portal":"PG"}', '{}'),
    'valor malformado continua fechando';
  assert not public.elegivel('{"portal":"PG"}', '{"portal":"PG"}'),
    'valor malformado continua fechando mesmo casando';
  assert not public.elegivel('{"dimensao_inexistente":["x"]}', '{"dimensao_inexistente":"x"}'),
    'chave desconhecida continua fechando mesmo quando a identidade casaria';
  assert not public.elegivel('{"centro_custos":["100"]}', '{"centro_custo":"100"}'),
    'typo no nome da dimensao continua fechando';
  assert public.elegivel('{"foo":null}', '{}'),
    'chave desconhecida com null continua sendo ignorada';
  assert not public.elegivel('{"portal":["PG"],"perfil":["FOLHA"]}', '{"portal":"PG","perfil":"RH"}'),
    'E entre dimensoes continua valendo';
  assert not public.elegivel('{"centro_custo":["100"]}', '{"centro_custo":"0100"}'),
    'zero a esquerda continua nao casando';
  assert public.elegivel('{"base":["b"],"portal":["p"],"perfil":["pe"],"usuario":["u"],"empresa":["e"],"matricula":["m"],"filial":["f"],"centro_custo":["c"],"unidade_adm":["ua"],"unidade_negocio":["un"],"vinculo":["v"],"sindicato":["s"]}',
    '{"base":"b","portal":"p","perfil":"pe","usuario":"u","empresa":"e","matricula":"m","filial":"f","centro_custo":"c","unidade_adm":"ua","unidade_negocio":"un","vinculo":"v","sindicato":"s"}'),
    'as doze dimensoes continuam conhecidas';
end $$;
