-- =====================================================================
-- `gestao_consumo` E `gestao_alocacoes` ERAM EXECUTÁVEIS POR `anon`
--
-- Defeito PRÉ-EXISTENTE, não desta branch, e é o irmão do que
-- `20260925020000` fechou em `gestao_consumo_facetas`. Conferido no banco
-- de produção em 25/09, na forma que não deixa dúvida:
--
--   gestao_consumo    secdef=true  {=X/postgres,postgres=X/postgres,service_role=X/postgres}
--   gestao_alocacoes  secdef=true  {=X/postgres,postgres=X/postgres,service_role=X/postgres}
--
-- O `=X/postgres` sem papel à esquerda é EXECUTE para PUBLIC, que toda
-- função recém criada recebe. As migrations de 08/09 fizeram
-- `revoke execute ... from anon, authenticated`, e isso não tira nada:
-- revogar dos papéis NOMEADOS deixa o grant de PUBLIC valendo, e `anon`
-- continua alcançando pelo PostgREST. As duas são `security definer`,
-- então a RLS não é anteparo.
--
-- ── O que dava para obter sem conta nenhuma ──────────────────────────
-- O primeiro argumento é o código do cliente, e ele é ADIVINHÁVEL: os que
-- aparecem em conversas reais são palavras curtas do tipo `natcorp`,
-- `leadec`, `incor`, `saude`, `stefanini`. Com um chute certo:
--
--   gestao_consumo    consumo por painel × perfil × usuário × empresa ×
--                     matrícula, com chamadas, conversas, tokens de
--                     entrada e saída, tokens brutos e créditos. Ou seja
--                     VOLUME, não só valores distintos — é pior que a
--                     facetas, que devolvia a lista de valores;
--   gestao_alocacoes  como os créditos daquele cliente estão distribuídos
--                     por painel e por alvo (usuário/perfil), com saldo.
--
-- ── Conferido ANTES de revogar ───────────────────────────────────────
-- Dois chamadores, `lerConsumo` em src/lib/gestao/dados.ts:201 e
-- `lerAlocacoes` em :247. Aquele módulo inteiro usa `createAdminClient()`,
-- ou seja `service_role`, porque a identidade de quem abre a área de
-- gestão não é conta do Supabase: é o token assinado do APEX, resolvido no
-- servidor. Por isso revogar é inócuo para a tela — o isolamento sempre
-- foi o `baseCode` vindo do token verificado, nunca o grant.
--
-- `authenticated` não entra: ninguém provou precisar, e as irmãs
-- (gestao_ciclos, gestao_plano, gestao_conversas_facetas,
-- gestao_portao_credito, gestao_compras) são todas `postgres,
-- service_role`. Estas duas e a facetas eram as três fora do padrão.
--
-- Assinatura COMPLETA nos dois `revoke`: `revoke` sem a assinatura certa
-- falha ou erra a função em nome sobrecarregado. Conferido antes de
-- escrever — nenhuma das duas tem sobrecarga hoje, e escrever a
-- assinatura é o que mantém isso verdade se um dia tiver.
-- =====================================================================

revoke all on function
  public.gestao_consumo(text, timestamptz, timestamptz, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function
  public.gestao_consumo(text, timestamptz, timestamptz, text, text, text, text, text)
  to service_role;

revoke all on function public.gestao_alocacoes(text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.gestao_alocacoes(text, timestamptz)
  to service_role;

comment on function public.gestao_consumo(text, timestamptz, timestamptz, text, text, text, text, text) is
  'Consumo em créditos de UMA base, por painel × perfil × usuário × empresa × matrícula, com filtro opcional em cada eixo. `atribuido = false` marca o que não pode ser imputado a um recorte. Só `service_role`: é `security definer` e devolve VOLUME (chamadas, conversas, tokens, créditos) por pessoa, então com EXECUTE para PUBLIC (como estava até 25/09) `anon` obtinha isso pelo PostgREST com um p_base adivinhado — os códigos de base são palavras curtas. O único chamador (lerConsumo, src/lib/gestao/dados.ts) usa createAdminClient(); o isolamento é o baseCode do token verificado, não o grant.';

comment on function public.gestao_alocacoes(text, timestamptz) is
  'Alocação de créditos de UMA base por painel e por alvo (usuário/perfil), com saldo, num momento. Só `service_role`: mesmo motivo de gestao_consumo — `security definer` com EXECUTE para PUBLIC deixava `anon` ler a distribuição de crédito de qualquer cliente pelo PostgREST com um p_base adivinhado. O único chamador (lerAlocacoes, src/lib/gestao/dados.ts) usa createAdminClient().';

-- ── Assertivas: uma por função, pinando o resultado ──────────────────
do $$
declare
  v_quem text;
begin
  select string_agg(distinct grantee, ', ' order by grantee)
    into v_quem
    from information_schema.role_routine_grants
   where routine_schema = 'public' and routine_name = 'gestao_consumo';
  assert v_quem = 'postgres, service_role',
    'grants de gestao_consumo deveriam ser postgres, service_role — vieram: ' || coalesce(v_quem, '(nenhum)');
end $$;

do $$
declare
  v_quem text;
begin
  select string_agg(distinct grantee, ', ' order by grantee)
    into v_quem
    from information_schema.role_routine_grants
   where routine_schema = 'public' and routine_name = 'gestao_alocacoes';
  assert v_quem = 'postgres, service_role',
    'grants de gestao_alocacoes deveriam ser postgres, service_role — vieram: ' || coalesce(v_quem, '(nenhum)');
end $$;

-- PUBLIC direto no ACL não aparece em `role_routine_grants` com nome de
-- papel, então a assertiva acima passaria com `=X/postgres` ainda lá se o
-- `revoke` tivesse errado a assinatura. Esta olha o ACL cru, que é onde o
-- PUBLIC mora de verdade.
do $$
declare
  v_acl text;
begin
  select string_agg(p.proname || '=' || coalesce(p.proacl::text, '(padrao)'), ' | ' order by p.proname)
    into v_acl
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('gestao_consumo', 'gestao_alocacoes')
     and (p.proacl is null or exists (
           select 1 from aclexplode(p.proacl) a where a.grantee = 0  -- 0 = PUBLIC
         ));
  assert v_acl is null,
    'ainda ha EXECUTE para PUBLIC (grantee 0) ou ACL padrao em: ' || v_acl;
end $$;
