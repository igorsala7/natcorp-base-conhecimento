-- Biblioteca de prompts salvos pelo usuário para REUSO nos chats (Fase 3).
-- Duas tabelas conforme a identidade (a pedido):
--  · prompts_usuario_sistema — usuário LOGADO na plataforma (auth.users.id);
--  · prompts_usuario_cliente — visitante do portal/widget, identificado pelos
--    parâmetros P_BASE + P_USUARIO (strings não verificadas), por documentação.
-- Só texto reusável; não é segredo.

-- ── Logado ────────────────────────────────────────────────────────────────────
create table public.prompts_usuario_sistema (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text,               -- rótulo curto opcional
  texto text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index prompts_usuario_sistema_user_idx on public.prompts_usuario_sistema (user_id, updated_at desc);

alter table public.prompts_usuario_sistema enable row level security;
create policy prompts_usuario_sistema_rw on public.prompts_usuario_sistema for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
revoke all on public.prompts_usuario_sistema from anon;

create trigger trg_prompts_usuario_sistema_updated_at
  before update on public.prompts_usuario_sistema
  for each row execute function public.touch_updated_at();

-- ── Cliente (portal/widget) ──────────────────────────────────────────────────
-- Sem sessão verificada: escrito/lido pelo servidor (service-role) nas rotas do
-- portal/widget, chaveado por (space_id, p_base, p_usuario). RLS nega clientes.
create table public.prompts_usuario_cliente (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  p_base text not null,
  p_usuario text not null,
  label text,
  texto text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index prompts_usuario_cliente_idx on public.prompts_usuario_cliente (space_id, p_base, p_usuario, updated_at desc);

alter table public.prompts_usuario_cliente enable row level security;
revoke all on public.prompts_usuario_cliente from anon, authenticated;

create trigger trg_prompts_usuario_cliente_updated_at
  before update on public.prompts_usuario_cliente
  for each row execute function public.touch_updated_at();
