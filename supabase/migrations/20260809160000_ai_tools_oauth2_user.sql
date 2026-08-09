-- =====================================================================
-- `oauth2_user` também é auth_type de FERRAMENTA
--
-- A migration 20260808160000 abriu o tipo em `ai_base_credentials`, mas
-- `ai_tools.auth_type` tem a própria restrição — herdada do check original do
-- módulo de integrações. O cadastro das ferramentas do Graph bateu nela:
--
--   new row for relation "ai_tools" violates check constraint
--   "ai_tools_auth_type_check"
--
-- As duas listas precisam andar juntas: a da credencial diz o que é possível
-- configurar, a da ferramenta diz o que é possível exigir. Divergir só produz
-- um erro no momento do cadastro, longe da causa.
-- =====================================================================

alter table public.ai_tools
  drop constraint if exists ai_tools_auth_type_check;
alter table public.ai_tools
  add constraint ai_tools_auth_type_check
  check (auth_type in ('none', 'basic', 'api_key', 'bearer', 'oauth2', 'oauth2_user'));
