-- =====================================================================
-- Fecha o EXECUTE de `anon` nas funções de manutenção.
--
-- A armadilha: neste projeto o Supabase tem ALTER DEFAULT PRIVILEGES que
-- concede EXECUTE a `anon` em TODA função nova do schema public. Um
--     revoke execute on function f() from public, authenticated;
-- (foi exatamente o que a migration do gc_versions fez, na Fase 8) remove a
-- concessão implícita do PUBLIC e a de authenticated, mas NÃO remove a
-- concessão EXPLÍCITA que o anon ganhou no momento da criação.
--
-- Resultado medido no banco antes desta migration:
--     select proacl from pg_proc where proname='gc_versions'
--     → {postgres=X/postgres, anon=X/postgres, service_role=X/postgres}
-- e um `set local role anon; select public.gc_versions();` EXECUTOU.
--
-- Ou seja: um visitante anônimo, pelo PostgREST, podia apagar o histórico de
-- versões dos artigos. Também podia zerar `rate_limits` (derrubando todos os
-- tetos de uso) e consumir buckets alheios via rate_limit_hit — negando
-- serviço ao widget de um cliente pagante.
--
-- Daqui em diante, revogar SEMPRE das três: public, anon, authenticated.
-- =====================================================================

-- ── Manutenção: só cron e service-role ───────────────────────────────────
revoke all on function public.gc_versions() from public, anon, authenticated;
revoke all on function public.rate_limits_gc() from public, anon, authenticated;
revoke all on function public.purge_trash(int) from public, anon, authenticated;
revoke all on function public.fail_stale_import_jobs(int) from public, anon, authenticated;

-- ── rate_limit_hit: só service-role ──────────────────────────────────────
-- Todos os chamadores da aplicação usam o cliente admin (widget/auth.ts,
-- portal/rate-limit.ts, api/portal/chat). `verify_space_password` também a
-- chama, mas é SECURITY DEFINER e roda como dono, sem depender do grant.
-- Com anon podendo chamar, dava para incrementar o bucket `k:<keyId>` de uma
-- chave de widget alheia até estourar o limite dela.
revoke all on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;

-- ── subtree_ids: authenticated sim, anon não ─────────────────────────────
-- Usada com a sessão do usuário em article-actions.ts (reindex de subárvore),
-- então `authenticated` PRECISA manter. Para o anon era enumeração da árvore
-- de qualquer espaço, inclusive privado.
revoke all on function public.subtree_ids(uuid) from public, anon;
grant execute on function public.subtree_ids(uuid) to authenticated;

-- ── max_role_level: nenhuma chamada anônima legítima ─────────────────────
-- Usada dentro de outras funções SECURITY DEFINER (que rodam como dono) e em
-- nenhuma policy. Para o anon era sondagem do nível de um usuário.
revoke all on function public.max_role_level(uuid, uuid) from public, anon;
grant execute on function public.max_role_level(uuid, uuid) to authenticated;

-- ── Defesa em profundidade nos gravadores de segredo ─────────────────────
-- set_ai_provider_key e set_email_secret JÁ barram com
-- `max_role_level(auth.uid(), null) < 100` — verificado: o anon recebe
-- "Apenas o Owner pode alterar chaves de API". Mas a ACL delas ainda tinha o
-- `=X` do PUBLIC, então a única barreira era o corpo da função. Some-se a
-- barreira de permissão.
revoke all on function public.set_ai_provider_key(uuid, text) from public, anon;
revoke all on function public.set_email_secret(text, text) from public, anon;
grant execute on function public.set_ai_provider_key(uuid, text) to authenticated;
grant execute on function public.set_email_secret(text, text) to authenticated;

-- has_permission NÃO entra aqui: as policies de RLS a chamam durante consultas
-- do próprio anon (portal público), então revogar dele quebraria o portal.
