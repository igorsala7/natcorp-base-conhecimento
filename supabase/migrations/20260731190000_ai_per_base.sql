-- IA por base (Fase 2): cada base pode ter PROVEDORES e ATRIBUIÇÕES próprios
-- (contas/credenciais e "qual IA faz o quê"), com fallback para o PADRÃO global.
-- Convenção: base_code = '' significa GLOBAL/PADRÃO (vale para todas as bases).

alter table public.ai_providers add column if not exists base_code text not null default '';
create index if not exists ai_providers_base_idx on public.ai_providers (base_code);

alter table public.ai_assignments add column if not exists base_code text not null default '';

-- A PK passa de (purpose) para (base_code, purpose): permite uma atribuição por
-- finalidade POR BASE. As linhas atuais viram o padrão (base_code = '').
alter table public.ai_assignments drop constraint if exists ai_assignments_pkey;
alter table public.ai_assignments add constraint ai_assignments_pkey primary key (base_code, purpose);
