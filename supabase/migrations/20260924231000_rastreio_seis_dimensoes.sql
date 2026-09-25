-- =====================================================================
-- SEIS DIMENSÕES NOVAS DE RASTREIO, E A REGRA DE ELEGIBILIDADE EM SQL
--
-- Decisão do dono (24/09): a elegibilidade de conteúdo passa a ter doze
-- dimensões. Seis já existiam; estas seis nascem aqui.
--
-- Todas são a ALOCAÇÃO da pessoa, não o que ela gerencia. Vínculo é o
-- empregatício (CLT, PJ, autônomo, estagiário). Os valores vivem nos
-- endpoints de estrutura do ERP, que já são ferramentas ATIVAS do
-- catálogo, exceto unidade de negócio, que será cadastrada depois.
--
-- ── Por que colunas, e não um jsonb ─────────────────────────────────
-- `conversations` é lida por filtro na tela de Conversas e pelas RPCs de
-- faceta, que agrupam por valor. Num jsonb cada filtro viraria expressão e
-- nenhum índice serviria. E o rastreio é um conjunto FECHADO decidido
-- pelo dono, não um saco aberto de atributos.
--
-- ── `public.elegivel`, e por que ela repete o TypeScript ────────────
-- O corte tem de acontecer no banco porque `widget.js` é público: mandar
-- a lista inteira para o navegador filtrar entregaria ao cliente os
-- nomes de tudo que ele NÃO pode ver. O predicado em TypeScript existe
-- porque a tela mostra a frase enquanto o admin digita.
--
-- As duas lêem `src/lib/elegibilidade/casos.json` e
-- `npm run verificar:elegibilidade` falha se discordarem em um caso.
-- =====================================================================

alter table public.conversations
  add column if not exists p_filial          text,
  add column if not exists p_centro_custo    text,
  add column if not exists p_unidade_adm     text,
  add column if not exists p_unidade_negocio text,
  add column if not exists p_vinculo         text,
  add column if not exists p_sindicato       text;

comment on column public.conversations.p_filial is
  'Filial de ALOCAÇÃO da pessoa. Vem do token de rastreio; nulo em cliente cujo bloco APEX ainda não foi recolado.';
comment on column public.conversations.p_centro_custo is
  'Centro de custo de ALOCAÇÃO da pessoa, não os que ela gerencia. Um gestor de três CCs tem um CC próprio, e é esse que conta.';
comment on column public.conversations.p_unidade_adm is
  'Unidade administrativa de alocação da pessoa.';
comment on column public.conversations.p_unidade_negocio is
  'Unidade de negócio de alocação. Única das seis sem endpoint de estrutura no catálogo (24/09), portanto a única com digitação livre na tela.';
comment on column public.conversations.p_vinculo is
  'Vínculo EMPREGATÍCIO (CLT, PJ, autônomo, estagiário), não vínculo com a empresa.';
comment on column public.conversations.p_sindicato is
  'Sindicato da pessoa.';

-- ── `page_views` espelha o mesmo conjunto de rastreio ────────────────
-- `page_views` já carregava as sete colunas `p_*` de sempre (nunca escolheu
-- um subconjunto — é o espelho completo de `TRACKING_KEYS`, não uma seleção
-- editorial). As seis entram aqui pela mesma razão, não por demanda de
-- analítica de visita de página.
--
-- A alternativa era estreitar o spread em
-- `src/app/api/portal/track/route.ts` para as sete chaves antigas. Foi
-- recusada: um subconjunto explícito ali apodrece em silêncio — alguém
-- acrescenta uma dimensão nova ao rastreio meses depois, o route continua
-- descartando o valor sem erro, e a análise mostra nulo para sempre sem
-- nenhum sinal de que falta algo.
alter table public.page_views
  add column if not exists p_filial          text,
  add column if not exists p_centro_custo    text,
  add column if not exists p_unidade_adm     text,
  add column if not exists p_unidade_negocio text,
  add column if not exists p_vinculo         text,
  add column if not exists p_sindicato       text;

-- ── A regra, em SQL ─────────────────────────────────────────────────
-- Assinatura em jsonb (e não doze pares de text[]/text) porque toda RPC
-- dos projetos 1 a 3 vai chamá-la, e uma função de 24 argumentos erra na
-- ordem em silêncio: trocar `filial` com `centro_custo` compila, roda e
-- devolve o conteúdo errado para o cliente errado.
create or replace function public.elegivel(regra jsonb, identidade jsonb)
returns boolean
language sql
immutable parallel safe
as $$
  select not exists (
    select 1
      from jsonb_each(coalesce(regra, '{}'::jsonb)) r(dim, lista)
     -- `null` é dimensão NÃO CONFIGURADA, e não restrição vazia: mesma leitura
     -- que `allowlist_casa(null, x)` já faz.
     where jsonb_typeof(r.lista) <> 'null'
       and (
            -- VALOR MALFORMADO FECHA, e esta linha é a correção de 24/09.
            -- A primeira versão pulava a dimensão quando o valor não era lista,
            -- e pular ABRE: uma regra gravada como {"portal":"PG"} em vez de
            -- {"portal":["PG"]} liberava o conteúdo para todo mundo, inclusive
            -- para quem não manda `p_portal` nenhum. Num ponto único que três
            -- projetos vão chamar, e sem erro em lugar nenhum.
            -- Fecha mesmo quando a identidade casaria: não se adivinha intenção
            -- de regra malformada, e quem impede a regra malformada de existir é
            -- o caminho de gravação, não este predicado.
            jsonb_typeof(r.lista) <> 'array'
         or not public.allowlist_casa(
              (select array_agg(x #>> '{}') from jsonb_array_elements(r.lista) x),
              identidade #>> array[r.dim]
            )
       )
  );
$$;

comment on function public.elegivel(jsonb, jsonb) is
  'Alcance de uma regra de elegibilidade sobre uma identidade, nas doze dimensões. Dentro da dimensão OU, entre dimensões E, lower(btrim()) dos dois lados, lista vazia libera, valor AUSENTE contra dimensão restrita FECHA, valor jsonb `null` = dimensão não configurada e LIBERA, e qualquer valor que não seja array nem null (string, número, booleano, objeto) é regra MALFORMADA e FECHA, mesmo quando a identidade casaria — quem impede a regra malformada de existir é o caminho de gravação, não este predicado. Gêmea de src/lib/elegibilidade/alcanca.ts; npm run verificar:elegibilidade prova que concordam.';

revoke all on function public.elegivel(jsonb, jsonb) from public, anon;
grant execute on function public.elegivel(jsonb, jsonb) to authenticated, service_role;

-- ── Assertivas ──────────────────────────────────────────────────────
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
