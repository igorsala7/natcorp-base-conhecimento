-- Instruções de navegação salvas para a captura interativa (Fase 2).
-- O usuário descreve o passo a passo que a IA deve seguir num site (cliques,
-- campos, telas a printar) e pode SALVAR com título/descrição para reusar depois
-- ("usar a instrução X"). É texto (o mesmo que alimenta destino.instrucao no
-- worker), não segredo — RLS pelas mesmas permissões da captura.
create table public.capture_recipes (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  name text not null,
  description text,
  url text,                 -- exemplo/opcional da página onde a instrução se aplica
  instrucao text not null,  -- o passo a passo de navegação (texto)
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index capture_recipes_space_idx on public.capture_recipes (space_id);

alter table public.capture_recipes enable row level security;
create policy capture_recipes_rw on public.capture_recipes for all to authenticated
  using (
    public.has_permission(auth.uid(), 'content.import', space_id)
    or public.has_permission(auth.uid(), 'content.create', space_id)
  )
  with check (
    public.has_permission(auth.uid(), 'content.import', space_id)
    or public.has_permission(auth.uid(), 'content.create', space_id)
  );
revoke all on public.capture_recipes from anon;

create trigger trg_capture_recipes_updated_at
  before update on public.capture_recipes
  for each row execute function public.touch_updated_at();
