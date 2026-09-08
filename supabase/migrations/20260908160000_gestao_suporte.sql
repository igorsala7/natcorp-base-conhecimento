-- =====================================================================
-- PERMISSÃO `gestao.suporte` — abrir a gestão de QUALQUER cliente
--
-- A área /gestao é do cliente e se autentica pelo token do APEX, assinado com a
-- chave daquela base. A equipe interna precisa da mesma tela para dar suporte,
-- e não tem token de cliente nenhum — nem deve ter: emitir um token em nome do
-- cliente para uso interno destruiria o rastro de quem fez o quê.
--
-- Em vez disso existe um SEGUNDO caminho de entrada, pela sessão do Supabase +
-- esta permissão, com a base escolhida na querystring. Quem autoriza é o RBAC,
-- não o token — e o `audit_log` registra o usuário interno de verdade.
--
-- ── Por que uma permissão só para isto ─────────────────────────────────
-- Ela alcança consumo, fatura e o HISTÓRICO DE CONVERSAS de todos os clientes.
-- Pendurar em `integrations.manage` daria isso de brinde a quem só precisa
-- cadastrar endpoint, e em `ai.configure`, a quem só cuida de modelo e preço.
-- Separada, dá para conceder a alguém do suporte sem entregar credenciais.
--
-- Nasce em Owner e Admin técnico. Conceder a mais alguém é decisão de quem
-- administra, na tela de usuários.
-- =====================================================================

insert into public.permissions (key, description)
values (
  'gestao.suporte',
  'Abrir a área de gestão de qualquer cliente (consumo, créditos, acessos e conversas) para dar suporte'
)
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
  from public.roles r, public.permissions p
 where r.key in ('owner', 'admin_tech')
   and p.key = 'gestao.suporte'
on conflict do nothing;

-- ── Rastro de quem abriu a gestão de quem ──────────────────────────────
-- Não é o `audit_log` das escritas (essas já gravam lá). É a LEITURA: saber que
-- alguém do suporte abriu o histórico de conversas de um cliente é o tipo de
-- coisa que só se pergunta depois de um incidente, quando já é tarde para
-- começar a registrar.
create table if not exists public.gestao_suporte_acessos (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id),
  base_code text not null,
  pagina text not null,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

comment on table public.gestao_suporte_acessos is
  'Quem, do time interno, abriu a área de gestão de qual cliente e quando. Só leitura de suporte; as escritas continuam em audit_log.';

create index if not exists gestao_suporte_acessos_base_idx
  on public.gestao_suporte_acessos (base_code, created_at desc);
create index if not exists gestao_suporte_acessos_actor_idx
  on public.gestao_suporte_acessos (actor_id, created_at desc);

alter table public.gestao_suporte_acessos enable row level security;

drop policy if exists gestao_suporte_acessos_read on public.gestao_suporte_acessos;
create policy gestao_suporte_acessos_read on public.gestao_suporte_acessos
  for select to authenticated using (
    public.has_permission(auth.uid(), 'audit.read', null)
  );

revoke all on public.gestao_suporte_acessos from anon;
