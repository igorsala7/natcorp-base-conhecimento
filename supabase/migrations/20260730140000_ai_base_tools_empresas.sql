-- Allowlist de EMPRESA por (base, ferramenta) — 3ª dimensão de acesso ao lado de
-- portais/perfis (#4). Vazio = liberado (qualquer empresa). O filtro casa com o
-- p_empresa (cod_empresa resolvido na identidade). Regra: acesso =
--   (operador OU portais vazio OU p_portal ∈ portais)
--   E (empresas vazio OU p_empresa ∈ empresas)   -- o PO NÃO ignora empresa
--   E (perfis vazio OU p_perfil ∈ perfis)
alter table public.ai_base_tools
  add column if not exists empresas text[] not null default '{}';
