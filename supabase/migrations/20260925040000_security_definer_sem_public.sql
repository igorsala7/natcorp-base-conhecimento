-- =====================================================================
-- CINCO FUNÇÕES `security definer` QUE QUALQUER PESSOA NA INTERNET
-- PODIA CHAMAR SEM LOGIN
--
-- Defeito PRÉ-EXISTENTE, encontrado na varredura de 25/09. É a terceira
-- leva do MESMO padrão que `20260925020000` e `20260925030000` fecharam:
-- a migration original revogava dos papéis NOMEADOS e deixava o grant de
-- PUBLIC valendo. As quatro `ai_*` inclusive já diziam
-- `revoke all ... from anon` em 31/07 — e `anon` continuou alcançando,
-- porque PUBLIC inclui `anon`. Revogar de `anon` sem revogar de PUBLIC
-- não fecha nada, e essa frase merece ficar escrita: é o terceiro arquivo
-- desta onda a existir por causa dela.
--
-- ACL antes (o `=X/postgres` sem papel à esquerda é PUBLIC):
--
--   ai_daily_tokens     {=X/postgres,postgres=X,authenticated=X,service_role=X}
--   ai_slot_acquire     {=X/postgres,postgres=X,authenticated=X,service_role=X}
--   ai_slot_release     {=X/postgres,postgres=X,authenticated=X,service_role=X}
--   ai_usage_window     {=X/postgres,postgres=X,authenticated=X,service_role=X}
--   approvers_for_node  {=X/postgres,postgres=X,anon=X,authenticated=X,service_role=X}
--
-- ── A pior das cinco, e ela não vaza dado nenhum ─────────────────────
-- `ai_slot_acquire` ESCREVE: ela toma um lease do semáforo de
-- concorrência daquele cliente. E ela recebe `p_max` e `p_ttl_seconds`
-- DE QUEM CHAMA — o teto não está dentro da função, está no argumento.
--
-- Então um anônimo, com um `p_tenant` adivinhado (é o código da base) e um
-- TTL longo, podia ocupar as vagas de concorrência do chat daquele
-- cliente. O efeito não é vazamento: é o chatbot de um cliente pagante
-- PARAR DE RESPONDER, devolvendo "Muitas solicitações simultâneas nesta
-- base" para todo mundo, até os leases expirarem. Custa uma chamada e não
-- deixa rastro de autenticação. É por isso que ela é a mais urgente das
-- cinco.
--
-- ── O que as outras quatro entregavam ────────────────────────────────
--   ai_daily_tokens     tokens consumidos no dia por aquele tenant: volume
--                       de uso de um cliente, com o código adivinhável;
--   ai_usage_window     janela agregada de uso da plataforma inteira;
--   ai_slot_release     ESCREVE: solta um lease. Precisa do uuid, então
--                       exige adivinhar um uuid v4 — impraticável, mas o
--                       grant não tinha por que existir;
--   approvers_for_node  os `user_id` de quem aprova um nó: uuid de usuário
--                       interno, a partir de um uuid de nó.
--
-- ── Conferido ANTES de revogar, função por função ────────────────────
-- Chamador único em cada uma, e todos com `createAdminClient()`
-- (`service_role`):
--
--   ai_daily_tokens     src/lib/ai/tenant-guard.ts:49
--   ai_slot_acquire     src/lib/ai/tenant-guard.ts:63
--   ai_slot_release     src/lib/ai/tenant-guard.ts:77
--   ai_usage_window     src/app/api/metrics/route.ts:25-26  (a rota ainda
--                       exige a permissão `data.analyze`)
--   approvers_for_node  src/lib/content/review-notify.ts:30
--
-- `tenant-guard.ts` é `server-only` e usa `createAdminClient()` nas três,
-- e TODO caminho de aquisição e liberação passa por ele — inclusive o de
-- desconexão do cliente em api/v1/chat/route.ts:3507 e
-- api/portal/chat/route.ts:401, que chamam `releaseSlot` do mesmo módulo.
-- Não existe caminho de limpeza com outro cliente.
--
-- E conferido no BANCO, não só no TypeScript: nenhuma das cinco é
-- referenciada por outra função, por policy de RLS, por view ou por
-- trigger (busca por `pg_get_functiondef`, `pg_get_expr` das policies,
-- `pg_get_viewdef` e `pg_get_triggerdef`). Isso importava em
-- `approvers_for_node`, que alimenta o e-mail do fluxo de aprovação: se
-- ela fosse chamada de dentro de uma policy, revogar quebraria a
-- aprovação em silêncio. Não é.
--
-- Assinatura COMPLETA em cada `revoke`: assinatura errada erra a função em
-- nome sobrecarregado. Nenhuma das cinco tem sobrecarga hoje.
-- =====================================================================

revoke all on function public.ai_daily_tokens(text) from public, anon, authenticated;
grant execute on function public.ai_daily_tokens(text) to service_role;

revoke all on function public.ai_slot_acquire(text, integer, integer) from public, anon, authenticated;
grant execute on function public.ai_slot_acquire(text, integer, integer) to service_role;

revoke all on function public.ai_slot_release(uuid) from public, anon, authenticated;
grant execute on function public.ai_slot_release(uuid) to service_role;

revoke all on function public.ai_usage_window(integer) from public, anon, authenticated;
grant execute on function public.ai_usage_window(integer) to service_role;

revoke all on function public.approvers_for_node(uuid) from public, anon, authenticated;
grant execute on function public.approvers_for_node(uuid) to service_role;

comment on function public.ai_slot_acquire(text, integer, integer) is
  'Toma um lease do semáforo de concorrência daquele tenant; devolve nulo quando o teto foi atingido. ESCREVE, e recebe `p_max`/`p_ttl_seconds` de quem chama — o teto está no argumento, não na função. Só `service_role`: até 25/09 tinha EXECUTE para PUBLIC, e com isso um anônimo com um p_tenant adivinhado e TTL longo ocupava as vagas do chat daquele cliente, fazendo o chatbot de um cliente pagante parar de responder. Não vaza dado; nega serviço. Chamador único: acquireSlot em src/lib/ai/tenant-guard.ts (server-only, createAdminClient).';

comment on function public.ai_slot_release(uuid) is
  'Solta um lease do semáforo de concorrência. ESCREVE. Só `service_role`: tinha EXECUTE para PUBLIC até 25/09; explorar exigia adivinhar um uuid, mas o grant não tinha por que existir. Chamador único: releaseSlot em src/lib/ai/tenant-guard.ts, inclusive no caminho de desconexão do cliente nas rotas de chat.';

comment on function public.ai_daily_tokens(text) is
  'Tokens consumidos nas últimas 24h por aquele tenant, para a cota diária. Só `service_role`: tinha EXECUTE para PUBLIC até 25/09, e o tenant é o código da base (adivinhável), então entregava volume de uso de um cliente a quem não tem conta. Chamador único: checkQuota em src/lib/ai/tenant-guard.ts.';

comment on function public.ai_usage_window(integer) is
  'Uso agregado da plataforma numa janela de N segundos, para a rota de métricas. Só `service_role`: tinha EXECUTE para PUBLIC até 25/09, o que expunha o agregado de uso a qualquer um. Chamador único: src/app/api/metrics/route.ts, que ainda exige a permissão data.analyze.';

comment on function public.approvers_for_node(uuid) is
  'Os user_id de quem pode aprovar a publicação daquele nó, considerando permissão por subárvore. Alimenta o e-mail do fluxo de aprovação. Só `service_role`: tinha EXECUTE para PUBLIC e grant nominal para anon até 25/09, e devolvia uuid de usuário interno a partir de um uuid de nó. Conferido que nenhuma policy de RLS nem outra função a chama — se chamasse, revogar quebraria a aprovação em silêncio. Chamador único: src/lib/content/review-notify.ts.';

-- ── Assertivas: uma por função, e a do ACL cru ───────────────────────
do $$
declare
  v_nome  text;
  v_quem  text;
begin
  foreach v_nome in array array[
    'ai_daily_tokens', 'ai_slot_acquire', 'ai_slot_release',
    'ai_usage_window', 'approvers_for_node'
  ] loop
    select string_agg(distinct grantee, ', ' order by grantee)
      into v_quem
      from information_schema.role_routine_grants
     where routine_schema = 'public' and routine_name = v_nome;
    assert v_quem = 'postgres, service_role',
      'grants de ' || v_nome || ' deveriam ser postgres, service_role — vieram: '
        || coalesce(v_quem, '(nenhum)');
  end loop;
end $$;

-- `role_routine_grants` NÃO nomeia PUBLIC, então a assertiva acima passaria
-- com `=X/postgres` ainda no ACL se algum `revoke` tivesse errado a
-- assinatura. Esta olha o ACL cru por `grantee = 0`, que é onde PUBLIC mora,
-- e também pega `proacl` nulo (ACL padrão = PUBLIC).
do $$
declare
  v_acl text;
begin
  select string_agg(p.proname || '=' || coalesce(p.proacl::text, '(padrao)'), ' | ' order by p.proname)
    into v_acl
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('ai_daily_tokens', 'ai_slot_acquire', 'ai_slot_release',
                       'ai_usage_window', 'approvers_for_node')
     and (p.proacl is null or exists (
           select 1 from aclexplode(p.proacl) a where a.grantee = 0  -- 0 = PUBLIC
         ));
  assert v_acl is null,
    'ainda ha EXECUTE para PUBLIC (grantee 0) ou ACL padrao em: ' || v_acl;
end $$;
