-- =====================================================================
-- `vocabulario_rastreio` NÃO PRECISA DE `authenticated`, E COM ELE
-- QUALQUER CONTA ENUMERA MATRÍCULA DE TODO CLIENTE
--
-- A migration de 24/09 concedeu execute a `authenticated` além de
-- `service_role`. Foi erro de quem escreveu o plano. As funções irmãs
-- (gestao_ciclos, gestao_conversas_facetas, prompts_sugeridos) são todas
-- `postgres, service_role`, e esta é `security definer`: com `base_ref`
-- nulo ela devolve perfil, empresa, usuário e MATRÍCULA de todos os
-- clientes. `sugeridos.ts` já tinha comentário avisando do risco.
--
-- O único consumidor, `vocabularioDoEscopo`, usa `createAdminClient()`,
-- portanto `service_role`. O grant não servia a ninguém e abria
-- enumeração entre clientes para qualquer usuário com conta, inclusive um
-- Leitor restrito a um espaço.
--
-- Se algum dia uma tela precisar chamar isto com a sessão do usuário, que
-- receba `permission denied` e alguém reconceda de propósito, olhando
-- para este comentário.
-- =====================================================================

revoke all on function public.vocabulario_rastreio(text) from public, anon, authenticated;
grant execute on function public.vocabulario_rastreio(text) to service_role;

do $$
declare
  v_quem text;
begin
  select string_agg(distinct grantee, ', ' order by grantee)
    into v_quem
    from information_schema.role_routine_grants
   where routine_schema = 'public' and routine_name = 'vocabulario_rastreio';
  assert v_quem = 'postgres, service_role',
    'grants de vocabulario_rastreio deveriam ser postgres, service_role — vieram: ' || coalesce(v_quem, '(nenhum)');
end $$;
