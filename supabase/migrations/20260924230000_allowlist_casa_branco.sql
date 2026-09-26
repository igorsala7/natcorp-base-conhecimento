-- =====================================================================
-- UMA ENTRADA EM BRANCO NA ALLOWLIST LIBERAVA QUEM NÃO TEM O VALOR
--
-- Provado contra a função viva em 24/09:
--   allowlist_casa(array['','PG'], null) -> TRUE
--
-- A causa é a normalização: `coalesce(valor,'')` transforma ausência em
-- string vazia, e string vazia casa com uma entrada em branco da lista.
-- O efeito é o oposto da regra que o dono pediu ("ausência fecha"): uma
-- linha em branco salva sem intenção libera todo mundo que não manda
-- aquele parâmetro, e não há erro em lugar nenhum para investigar.
--
-- A correção é filtrar os brancos ANTES de decidir. Com isso:
--   · lista só de brancos      -> vira lista vazia -> LIBERADO (igual a
--     cardinality 0, que é a convenção do projeto);
--   · lista com branco + valor -> o branco é ignorado e a restrição vale;
--   · valor ausente            -> nunca casa, porque não há item vazio.
--
-- Latente e não explorado: as três linhas de prompt_sugerido em produção
-- não têm branco. A trava de verdade contra lista-só-de-brancos é a tela
-- recusar o salvamento (projeto 1); aqui garantimos que o pior caso
-- (branco junto de valor real) deixe de abrir.
--
-- ── O QUE SAIU DESTE ARQUIVO, E PARA ONDE FOI (tarefa 16) ────────────
-- A definição de `public.allowlist_casa(text[], text)` e o `comment on
-- function` dela saíram daqui e passaram a morar num sítio ÚNICO:
--
--   supabase/migrations/20260923050000_prompts_elegibilidade_completa.sql
--
-- Enquanto ela estava definida aqui TAMBÉM, reaplicar este arquivo sozinho —
-- operação normal, porque não há ledger — devolvia o `btrim` de UM argumento
-- em SILÊNCIO: o Postgres apara só o caractere espaço, e o `.trim()` do
-- JavaScript apara também TAB, LF, CR e NBSP. É o furo do NBSP ENTRE
-- CLIENTES, a metade que faltava do que a tarefa 12 fechou do outro lado —
-- uma base que difere só por NBSP é linha distinta para o índice único de
-- `ai_bases` e o MESMO valor para a dimensão `base` de `public.elegivel`.
--
-- A assinatura nunca mudou, então nem `npm run verificar:rpc` nem nenhuma
-- assertiva de assinatura enxergavam isso: era o CORPO que retrocedia.
-- `npm run verificar:corpo` é quem recusa o segundo sítio agora.
--
-- O sítio canônico é o arquivo MAIS ANTIGO, e não este, porque
-- `public.prompts_sugeridos` é criada no mesmo arquivo logo depois da função
-- e a chama no corpo: com `check_function_bodies` ligado, uma aplicação do
-- zero morreria lá se a definição estivesse aqui. O cabeçalho daquele arquivo
-- explica a dependência.
--
-- As ASSERTIVAS ficaram: este arquivo roda DEPOIS do sítio canônico, então
-- elas exercitam o corpo canônico e viram prova de replay. O furo que este
-- arquivo existe para fechar continua sendo verificado aqui.
-- =====================================================================

-- ── Assertivas: a migration falha se o comportamento regredir ────────
do $$
begin
  -- liberado
  assert public.allowlist_casa(null, null),                         'lista nula libera';
  assert public.allowlist_casa('{}'::text[], null),                 'lista vazia libera';
  assert public.allowlist_casa(array['', '  '], null),              'lista só de brancos libera';
  -- restrito
  assert public.allowlist_casa(array['PG'], 'PG'),                  'valor casa';
  assert public.allowlist_casa(array['pg'], ' PG '),                'caixa e espaco casam';
  assert not public.allowlist_casa(array['PG'], 'PC'),              'valor errado fecha';
  assert not public.allowlist_casa(array['PG'], null),              'ausencia fecha';
  assert not public.allowlist_casa(array['PG'], ''),                'vazio fecha';
  -- O FURO QUE ESTA MIGRATION EXISTE PARA FECHAR
  assert not public.allowlist_casa(array['', 'PG'], null),          'branco + valor: ausencia NAO pode passar';
  assert not public.allowlist_casa(array['  ', 'PG'], ''),          'espaco + valor: vazio NAO pode passar';
end $$;
