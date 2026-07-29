-- =====================================================================
-- Cache por ferramenta: dados quase-estáticos (estrutura da organização,
-- equipe do gestor, cadastro do próprio usuário) não precisam bater na API a
-- cada mensagem. `cache_ttl` (segundos) liga um cache em memória por
-- (base, ferramenta, parâmetros da API). NULL = sem cache (padrão).
--
-- Casa com o parâmetro convencional `termo` (local:none): quando a IA passa um
-- nome, o servidor FILTRA o resultado (cacheado) por nome antes de devolver —
-- assim a IA recebe só os casamentos, não a lista inteira (menos tokens).
-- =====================================================================
alter table public.ai_tools
  add column if not exists cache_ttl integer;

comment on column public.ai_tools.cache_ttl is
  'Segundos de cache em memória do resultado (por base+parâmetros). NULL = sem cache. Use em dados quase-estáticos (estrutura, equipe, cadastro do usuário).';
