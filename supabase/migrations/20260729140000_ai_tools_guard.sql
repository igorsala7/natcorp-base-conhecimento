-- =====================================================================
-- GUARD por ferramenta: uma checagem no SERVIDOR que roda ANTES da chamada da
-- API e pode recusar (ex.: um gestor só consulta um colaborador da sua equipe;
-- um saque só efetiva com código de confirmação válido). O nome aponta para uma
-- função em `src/lib/integrations/guards.ts`. NULL = sem guard.
-- =====================================================================
alter table public.ai_tools
  add column if not exists guard text;

comment on column public.ai_tools.guard is
  'Guard no servidor rodado antes da chamada (nome em lib/integrations/guards.ts): ex. team_membership, saque_confirmation. NULL = nenhum.';
