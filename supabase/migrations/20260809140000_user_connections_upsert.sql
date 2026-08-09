-- =====================================================================
-- A conexão por usuário precisa de restrição única DE VERDADE
--
-- A migration original criou um índice único PARCIAL:
--
--   create unique index ... on user_connections (credential_id, p_usuario)
--     where revoked_at is null;
--
-- A intenção era permitir reconectar depois de revogar e guardar o histórico
-- de revogações. Só que `ON CONFLICT (colunas)` do Postgres não casa com índice
-- parcial — casar exigiria repetir o predicado (`ON CONFLICT ... WHERE ...`), e
-- o PostgREST não tem como expressar isso no parâmetro `on_conflict`. Resultado
-- observado no primeiro consentimento real que chegou até aqui:
--
--   "there is no unique or exclusion constraint matching the ON CONFLICT
--    specification"
--
-- O consentimento inteiro funcionava — Microsoft autenticada, código trocado
-- por token — e morria na gravação.
--
-- ── A escolha ───────────────────────────────────────────────────────────
-- Troco o índice parcial por uma restrição única simples. O que se perde é o
-- histórico de revogações: reconectar passa a REUSAR a linha, limpando
-- `revoked_at`, em vez de criar outra. Aceitável — `user_connections` é o
-- estado atual da conexão, não uma trilha de auditoria. Quem precisar da
-- trilha tem `ai_tool_runs` e o `audit_log`, que existem para isso.
--
-- A alternativa seria ler-antes-de-gravar no código, o que reintroduz a corrida
-- que o upsert resolve: dois consentimentos simultâneos do mesmo usuário
-- criariam duas linhas ativas, e a leitura (`maybeSingle`) passaria a falhar.
-- =====================================================================

drop index if exists public.user_connections_ativa_idx;

-- Linhas duplicadas não deveriam existir (o índice parcial as impedia enquanto
-- ativas), mas uma revogada + uma ativa passariam. Consolida antes de criar a
-- restrição, mantendo a mais recente — que é a que vale.
delete from public.user_connections a
 using public.user_connections b
 where a.credential_id = b.credential_id
   and a.p_usuario = b.p_usuario
   and (a.updated_at < b.updated_at or (a.updated_at = b.updated_at and a.id < b.id));

alter table public.user_connections
  drop constraint if exists user_connections_credencial_usuario_key;
alter table public.user_connections
  add constraint user_connections_credencial_usuario_key
  unique (credential_id, p_usuario);

comment on constraint user_connections_credencial_usuario_key on public.user_connections is
  'Uma linha por (credencial, pessoa). Restrição SIMPLES e não parcial de propósito: é o que o ON CONFLICT do upsert consegue mirar. Reconectar reusa a linha e limpa revoked_at.';
