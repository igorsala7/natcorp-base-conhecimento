-- Escopo de dados POR PAINEL (PO=Operador, PG=Gestor, PC=Colaborador) por ferramenta.
-- Fecha o buraco em que uma tool com matrícula/empresa livres (origem=modelo, sem guard)
-- deixava um Colaborador (PC) consultar dados de QUALQUER pessoa.
--
--   panel_scope = { "PO": <e>, "PG": <e>, "PC": <e> }  com <e> ∈
--     "todos"    → sem recorte extra (o sistema aplica o acesso já parametrizado)
--     "equipe"   → só a equipe do gestor (valida a matrícula-alvo na equipe)
--     "proprios" → FORÇA a matrícula/empresa do próprio usuário (ignora o que a IA mandar)
--     "nenhum"   → a tool nem aparece para aquele painel (bloqueada)
--   Ausente/NULL para um painel = "todos" (retrocompatível).
--
--   exclude_self = o usuário NUNCA vê os PRÓPRIOS dados como alvo (ex.: requisição de
--   desligamento — ninguém pode ver que é o "matrícula solicitada").
alter table public.ai_tools add column if not exists panel_scope jsonb;
alter table public.ai_tools add column if not exists exclude_self boolean not null default false;

comment on column public.ai_tools.panel_scope is
  'Escopo de dados por painel {PO,PG,PC → todos|equipe|proprios|nenhum}. NULL/ausente = todos.';
comment on column public.ai_tools.exclude_self is
  'A consulta NUNCA pode trazer/mirar os próprios dados do usuário (ex.: requisição de desligamento).';
