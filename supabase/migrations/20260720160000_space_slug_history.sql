-- =====================================================================
-- Slug da documentação editável, SEM quebrar link já compartilhado.
--
-- A tabela `redirects` que já existe cobre o caminho DENTRO do espaço
-- (`from_path` relativo). Ela não serve aqui: quando a slug do espaço muda,
-- `/docs/<slug-antiga>/...` nem chega a resolver o espaço — morre antes.
-- =====================================================================

create table public.space_slugs (
  -- A slug é a PK global: impede que uma slug aposentada seja reaproveitada
  -- por outro espaço, o que faria links antigos apontarem para a documentação
  -- errada — pior do que um 404.
  slug text primary key,
  space_id uuid not null references public.spaces (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index space_slugs_space_idx on public.space_slugs (space_id);

alter table public.space_slugs enable row level security;

-- O portal público precisa ler para resolver o redirect de uma slug antiga.
-- Só expõe (slug → space_id); nada de conteúdo.
create policy space_slugs_public_read on public.space_slugs
  for select to anon using (true);
create policy space_slugs_auth_read on public.space_slugs
  for select to authenticated using (true);
create policy space_slugs_manage on public.space_slugs
  for all to authenticated using (
    public.has_permission(auth.uid(), 'space.manage', space_id)
  )
  with check (public.has_permission(auth.uid(), 'space.manage', space_id));

-- BACKFILL: as slugs atuais entram no histórico. É o que garante que a
-- checagem de colisão enxergue as slugs em uso desde o primeiro dia.
insert into public.space_slugs (slug, space_id)
select slug, id from public.spaces
on conflict (slug) do nothing;
