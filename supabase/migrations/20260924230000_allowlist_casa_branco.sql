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
-- =====================================================================

create or replace function public.allowlist_casa(lista text[], valor text)
returns boolean
language sql
immutable parallel safe
as $$
  with itens as (
    select lower(btrim(x)) as v
      from unnest(coalesce(lista, '{}'::text[])) x
     where btrim(coalesce(x, '')) <> ''
  )
  select not exists (select 1 from itens)
      or lower(btrim(coalesce(valor, ''))) in (select v from itens);
$$;

comment on function public.allowlist_casa(text[], text) is
  'Allowlist: lista vazia (ou só de brancos) não restringe; senão compara por lower(btrim()) dos dois lados, e valor AUSENTE nunca casa. Brancos são filtrados antes de decidir — sem isso, uma entrada em branco liberava quem não manda o parâmetro.';

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
