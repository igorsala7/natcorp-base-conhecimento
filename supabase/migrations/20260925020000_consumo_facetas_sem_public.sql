-- =====================================================================
-- `gestao_consumo_facetas` ERA EXECUTÁVEL POR `anon`, E ELA ENUMERA
-- USUÁRIO E MATRÍCULA DO CLIENTE
--
-- Defeito PRÉ-EXISTENTE, não desta branch. Conferido no banco de
-- produção em 25/09:
--
--   gestao_consumo_facetas  ->  PUBLIC, postgres, service_role
--
-- A migration de 08/09 fez `revoke execute ... from anon, authenticated`.
-- Isso não tira nada: o acesso vinha do grant para PUBLIC, que toda
-- função recém criada recebe, e revogar dos papéis nomeados deixa o
-- grant de PUBLIC valendo. A função é `security definer`, então ela roda
-- com o dono e a RLS não é anteparo.
--
-- O que dava para obter, com um `p_base` adivinhado (é o código do
-- cliente, coisa curta e pública) via PostgREST, sem nenhuma conta:
-- os valores DISTINTOS de `p_usuario`, `p_matricula`, `p_empresa` e
-- `p_perfil` daquele cliente, com contagem de chamadas. É a mesma classe
-- que esta branch fechou em `vocabulario_rastreio`, um degrau pior:
-- lá o grant indevido era para `authenticated`, aqui era para o anônimo.
--
-- ── Conferido ANTES de revogar ───────────────────────────────────────
-- Um único chamador, `lerFacetas` em src/lib/gestao/dados.ts:231, e ele
-- usa `createAdminClient()`, ou seja `service_role`. Nenhuma tela chama
-- isto com a sessão do usuário nem pelo widget (grep em src/, public/ e
-- api-docs/). Revogar não quebra tela nenhuma.
--
-- `authenticated` NÃO entra: ninguém provou precisar, e o modelo de
-- acesso da área de gestão não é conta do Supabase — é o token assinado
-- do APEX, resolvido no servidor, que já roda com service_role.
-- =====================================================================

revoke all on function public.gestao_consumo_facetas(text, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.gestao_consumo_facetas(text, timestamptz, timestamptz)
  to service_role;

comment on function public.gestao_consumo_facetas(text, timestamptz, timestamptz) is
  'Valores disponíveis para os filtros do consumo de UMA base, por eixo, com contagem. Alimenta os seletores com o que existe no período. Só `service_role`: é `security definer` e devolve os valores distintos de p_usuario, p_matricula, p_empresa e p_perfil do cliente, então com EXECUTE para PUBLIC (como estava até 25/09) `anon` enumerava isso pelo PostgREST com um p_base adivinhado. O único chamador (lerFacetas) usa createAdminClient().';

do $$
declare
  v_quem text;
begin
  select string_agg(distinct grantee, ', ' order by grantee)
    into v_quem
    from information_schema.role_routine_grants
   where routine_schema = 'public' and routine_name = 'gestao_consumo_facetas';
  assert v_quem = 'postgres, service_role',
    'grants de gestao_consumo_facetas deveriam ser postgres, service_role — vieram: ' || coalesce(v_quem, '(nenhum)');
end $$;

-- ── AINDA ABERTO, e é decisão do dono, não minha ─────────────────────
-- Medido na mesma consulta, e com o MESMO defeito (revoke dos papéis
-- nomeados sem tirar o de PUBLIC):
--
--   gestao_consumo    ->  PUBLIC, postgres, service_role
--   gestao_alocacoes  ->  PUBLIC, postgres, service_role
--
-- `gestao_consumo` é pior que a facetas: devolve consumo em créditos por
-- painel x perfil x usuário x empresa x matrícula. As duas são chamadas
-- só de src/lib/gestao/dados.ts (linhas 201 e 247), as duas com
-- `createAdminClient()`, então revogar aparenta ser seguro pelo mesmo
-- argumento usado aqui.
--
-- Não revoguei: a correção autorizada era esta função. Grant em produção
-- se mexe de propósito, uma por vez, com o chamador conferido — e quem
-- decide é o dono.
