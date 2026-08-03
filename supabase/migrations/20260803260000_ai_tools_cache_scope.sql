-- ESCOPO do cache de resultado (ai_tools.cache_ttl) — antes a chave incluía SEMPRE a
-- matrícula/usuário, então dados de REFERÊNCIA (iguais p/ todos) eram cacheados por
-- usuário: numa operação grande cada usuário rebatia na API. Agora:
--   'user'    → chave por usuário (padrão; dados pessoais/por-matrícula).
--   'empresa' → chave por empresa (compartilha entre usuários da mesma empresa;
--               ex.: estrutura organizacional, procedimentos, contas da empresa).
--   'global'  → chave só pelos args (compartilha entre TODOS; ex.: consulta de CEP).
-- Só faz efeito quando cache_ttl está setado. Só use 'empresa'/'global' quando a
-- SAÍDA da tool NÃO depender do usuário (senão um usuário veria dado de outro).
alter table public.ai_tools add column if not exists cache_scope text not null default 'user';

alter table public.ai_tools drop constraint if exists ai_tools_cache_scope_chk;
alter table public.ai_tools add constraint ai_tools_cache_scope_chk
  check (cache_scope in ('user', 'empresa', 'global'));

comment on column public.ai_tools.cache_scope is
  'Escopo da chave do cache de resultado: user (padrão) | empresa | global. Só use empresa/global quando a saída não depender do usuário.';
