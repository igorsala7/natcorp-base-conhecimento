-- Fase 5 — Espaços por cliente (herança por sobreposição, não por cópia).
-- space_overlays sobrepõe a árvore global no espaço de um cliente:
--   ocultar um nó, sobrescrever (fork) ou deixar herdado. Nós exclusivos do
--   cliente são nós comuns no espaço-cliente (sem overlay).

create table public.space_overlays (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,       -- espaço-cliente
  source_node_id uuid not null references public.nodes (id) on delete cascade,  -- nó global de origem
  hidden boolean not null default false,
  override_node_id uuid references public.nodes (id) on delete set null,        -- fork no espaço-cliente
  position_override text,
  created_at timestamptz not null default now(),
  unique (space_id, source_node_id)
);
create index space_overlays_space_idx on public.space_overlays (space_id);
create index space_overlays_source_idx on public.space_overlays (source_node_id);

alter table public.space_overlays enable row level security;

-- Leitura: quem vê o conteúdo do espaço-cliente (autenticado) ou o público.
create policy overlays_auth_read on public.space_overlays
  for select to authenticated using (
    public.has_permission(auth.uid(), 'content.view', space_id)
  );
create policy overlays_public_read on public.space_overlays
  for select to anon using (
    exists (
      select 1 from public.spaces s
      where s.id = space_overlays.space_id and s.visibility = 'public'
    )
  );
-- Escrita: exige overlay.manage no espaço-cliente.
create policy overlays_manage on public.space_overlays
  for all to authenticated using (
    public.has_permission(auth.uid(), 'overlay.manage', space_id)
  )
  with check (public.has_permission(auth.uid(), 'overlay.manage', space_id));
