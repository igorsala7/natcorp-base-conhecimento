-- Item #4 — Permissões por ferramenta: allowlists de PORTAL e PERFIL por
-- (base, ferramenta). Vazio = liberado (100%).
--
-- Semântica de acesso (resolvida no servidor, em buildIntegrationTools):
--   (operador OU portais vazio OU p_portal ∈ portais)  E
--   (perfis vazio OU p_perfil ∈ perfis)
-- onde "operador" = p_portal = 'PO' (acesso full às tools/dados, restrito apenas
-- pela allowlist de PERFIL do usuário conectado). O eixo gestor/colaborador
-- continua definindo apenas QUAL AGENTE de IA é usado (ai_agents.requires_perfil).

alter table ai_base_tools
  add column if not exists portais text[] not null default '{}',
  add column if not exists perfis text[] not null default '{}';

comment on column ai_base_tools.portais is
  'Portais liberados (PO/PG/PC). Vazio = todos. O operador (PO) ignora esta lista.';
comment on column ai_base_tools.perfis is
  'Perfis (p_perfil cru, ex. MASTER) liberados. Vazio = todos. Aplica inclusive ao operador.';

-- API (por base) que lista os perfis do cliente para popular o admin. Preenchida
-- depois pelo cliente; enquanto vazia, os perfis são digitados à mão no admin.
alter table ai_bases
  add column if not exists perfis_endpoint text,
  add column if not exists perfis_campo text;

comment on column ai_bases.perfis_endpoint is
  'Path (relativo ao base_url) da API que lista os perfis do cliente. Opcional.';
comment on column ai_bases.perfis_campo is
  'Nome do campo do JSON que contém o perfil (código/nome). Opcional.';
