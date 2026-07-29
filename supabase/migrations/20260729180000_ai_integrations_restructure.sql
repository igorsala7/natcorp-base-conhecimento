-- =====================================================================
-- Reestrutura das Integrações: a URL base e a credencial deixam de viver
-- por (base,tool) — redundantes, a mesma URL repetida em toda tool da base —
-- e passam para a PRÓPRIA base. Por (base,tool) sobra só o flag `enabled`.
--
-- Além disso: tools com ENDPOINT EXTERNO (outro serviço) passam a poder trazer
-- URL própria + credencial própria + um system_prompt próprio (concatenado ao
-- prompt quando a tool está ativa).
--
--   Interna  (endpoint_kind='base')     -> usa ai_bases.base_url + ai_bases.credential_id
--   Externa  (endpoint_kind='external') -> usa ai_tools.external_url + ai_tools.credential_id
-- =====================================================================

-- 1) Base ganha a URL base padrão + a credencial padrão (para tools internas).
alter table public.ai_bases
  add column if not exists base_url text,
  add column if not exists credential_id uuid references public.ai_base_credentials(id) on delete set null;

comment on column public.ai_bases.base_url is
  'URL base padrão desta base/cliente (usada pelas tools internas). Antes vivia por (base,tool) em ai_base_tools.';
comment on column public.ai_bases.credential_id is
  'Credencial padrão desta base (usada pelas tools internas). NULL = sem autenticação.';

-- 2) Tool ganha o conceito de endpoint externo + credencial própria + prompt próprio.
alter table public.ai_tools
  add column if not exists endpoint_kind text not null default 'base',
  add column if not exists external_url text,
  add column if not exists credential_id uuid references public.ai_base_credentials(id) on delete set null,
  add column if not exists system_prompt text not null default '';

alter table public.ai_tools drop constraint if exists ai_tools_endpoint_kind_check;
alter table public.ai_tools
  add constraint ai_tools_endpoint_kind_check check (endpoint_kind in ('base', 'external'));

comment on column public.ai_tools.endpoint_kind is
  'base = usa base_url+credencial da BASE; external = usa external_url+credential_id da própria TOOL (outro serviço).';
comment on column public.ai_tools.external_url is 'URL base do serviço externo (quando endpoint_kind=external).';
comment on column public.ai_tools.credential_id is 'Credencial da tool externa (FK ai_base_credentials). Só para endpoint_kind=external.';
comment on column public.ai_tools.system_prompt is 'Instrução própria da tool, concatenada ao prompt quando a tool está ativa. Padrão vazio.';

-- 3) Credenciais podem ser GLOBAIS (base_id NULL) — para tools externas cross-base.
alter table public.ai_base_credentials alter column base_id drop not null;
-- Nome único entre as credenciais globais (o UNIQUE(base_id,name) já cobre as por base).
create unique index if not exists ai_base_credentials_global_name_idx
  on public.ai_base_credentials (name) where base_id is null;

-- 4) Backfill: a base_url é uniforme por base no uso atual (NATCORP) → sobe para a base.
--    Pega, por base, uma linha de ai_base_tools com base_url não-nula (e sua credencial).
update public.ai_bases b set
  base_url = sub.base_url,
  credential_id = coalesce(b.credential_id, sub.credential_id)
from (
  select distinct on (base_id) base_id, base_url, credential_id
  from public.ai_base_tools
  where base_url is not null
  order by base_id, base_url
) sub
where sub.base_id = b.id and b.base_url is null;

-- ai_base_tools.base_url / credential_id ficam por ora (nullable, não usadas):
-- o runtime passa a resolver pela base (interna) ou pela tool (externa), com
-- fallback às colunas antigas durante a transição.
