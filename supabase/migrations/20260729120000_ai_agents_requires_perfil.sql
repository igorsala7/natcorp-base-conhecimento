-- =====================================================================
-- Agentes por PERFIL: um agente pode exigir um perfil (ex.: "gestor") para
-- que suas ferramentas apareçam. A checagem é no SERVIDOR (buildIntegrationTools),
-- usando o `perfil` resolvido no login (identity-resolver) — nunca do modelo.
--
-- NULL = sem exigência (vale para qualquer perfil), comportamento atual.
-- =====================================================================
alter table public.ai_agents
  add column if not exists requires_perfil text;

comment on column public.ai_agents.requires_perfil is
  'Perfil exigido (ex.: gestor) para expor as ferramentas deste agente; NULL = qualquer perfil. Checado no servidor com o perfil resolvido no login.';
