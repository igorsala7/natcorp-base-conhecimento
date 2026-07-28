-- Parametrização dos prompts do sistema (Sistema → Prompts). Cada categoria
-- guarda apenas os campos SOBRESCRITOS; o que não estiver aqui usa o default do
-- código-fonte (o código continua sendo o fallback). Restaurar = apagar a linha.
create table if not exists public.prompt_overrides (
  key text primary key,                       -- chave da categoria (ex.: 'assistente')
  fields jsonb not null default '{}'::jsonb,   -- { campo: valor, ... } só dos sobrescritos
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.prompt_overrides enable row level security;

-- Leitura/gravação para quem configura IA (Admin técnico 80+; Owner tem tudo).
drop policy if exists prompt_overrides_rw on public.prompt_overrides;
create policy prompt_overrides_rw on public.prompt_overrides for all to authenticated
  using (public.has_permission(auth.uid(), 'ai.configure', null))
  with check (public.has_permission(auth.uid(), 'ai.configure', null));
