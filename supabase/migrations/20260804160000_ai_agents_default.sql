-- Agente PADRÃO: reclama as tools ÓRFÃS (sem vínculo de agente). Sem isto, com agentes
-- ativos, uma tool sem agente é EXCLUÍDA — e a importação ORDS deixou ~61 tools órfãs.
-- Marcando 1+ agente como is_default, as órfãs passam a ser tratadas como curadas sob ele
-- (persona + trava de perfil do padrão), ainda filtradas por panel_scope/allowlists.
alter table public.ai_agents
  add column if not exists is_default boolean not null default false;

-- Índice p/ achar rápido o(s) agente(s) padrão ativo(s).
create index if not exists ai_agents_default_idx
  on public.ai_agents (is_default) where is_default and active;
