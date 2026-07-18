-- Fase 0.5 — Identidade e acesso (RBAC em tabela).
-- Fonte única de autorização: a função has_permission(), usada TANTO pelas
-- policies de RLS QUANTO pelo backend. Papéis nunca são hardcoded no código.

-- =====================================================================
-- 1. TABELAS
-- =====================================================================

-- Perfis — espelham auth.users (criados por trigger no signup).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  email text,
  status text not null default 'active'
    check (status in ('active', 'invited', 'suspended')),
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.profiles is 'Perfil público do usuário; 1:1 com auth.users.';

-- Papéis do sistema (hierarquia por nível; ver seed no fim).
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  level int not null,
  description text,
  is_system boolean not null default false
);
comment on column public.roles.level is
  'Nível hierárquico. Base da regra de não-escalada: ninguém concede papel >= ao seu.';

-- Catálogo de permissões atômicas.
create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  description text
);

-- Papel -> permissões.
create table public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

-- Vínculo usuário<->papel, opcionalmente restrito a espaço e a um nó da árvore.
-- space_id/node_id ficam sem FK aqui (as tabelas spaces/nodes chegam na Fase 1);
-- a FK é adicionada naquela migration.
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role_id uuid not null references public.roles (id),
  space_id uuid,               -- NULL = papel global (vale para todos os espaços)
  node_id uuid,                -- NULL = todo o espaço; senão restringe a uma subárvore
  granted_by uuid references auth.users (id),
  granted_at timestamptz not null default now(),
  expires_at timestamptz
);
comment on column public.memberships.space_id is
  'NULL = papel global. Preenchido = papel restrito ao espaço.';
create index memberships_user_idx on public.memberships (user_id);
create index memberships_space_idx on public.memberships (space_id);

-- Convites (fluxo por token de uso único, com expiração).
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role_id uuid not null references public.roles (id),
  space_id uuid,
  token text not null unique default encode(gen_random_bytes(32), 'hex'),
  invited_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz
);

-- Log de auditoria (append-only; sem update/delete via RLS).
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id),
  action text not null,
  entity_type text,
  entity_id text,
  space_id uuid,
  before jsonb,
  after jsonb,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);
create index audit_log_actor_idx on public.audit_log (actor_id);

-- =====================================================================
-- 2. FUNÇÕES DE AUTORIZAÇÃO (fonte única)
-- =====================================================================

-- has_permission: o usuário tem a permissão no escopo do espaço?
-- Considera papéis globais (space_id NULL) e do espaço. SECURITY DEFINER para
-- poder ser chamada de dentro das policies de RLS sem recursão.
create or replace function public.has_permission(
  p_user_id uuid,
  p_permission_key text,
  p_space_id uuid default null
) returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (
    select 1
    from memberships m
    join role_permissions rp on rp.role_id = m.role_id
    join permissions p on p.id = rp.permission_id
    where m.user_id = p_user_id
      and p.key = p_permission_key
      and (m.expires_at is null or m.expires_at > now())
      and (m.space_id is null or m.space_id = p_space_id)
  );
$$;

-- Maior nível do usuário no escopo (papéis globais contam para qualquer espaço).
create or replace function public.max_role_level(
  p_user_id uuid,
  p_space_id uuid default null
) returns int
  language sql
  stable
  security definer
  set search_path = public
as $$
  select coalesce(max(r.level), 0)
  from memberships m
  join roles r on r.id = m.role_id
  where m.user_id = p_user_id
    and (m.expires_at is null or m.expires_at > now())
    and (m.space_id is null or m.space_id = p_space_id);
$$;

-- =====================================================================
-- 3. TRIGGERS
-- =====================================================================

-- Cria o profile automaticamente quando um usuário nasce em auth.users.
create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when new.email_confirmed_at is null then 'invited' else 'active' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Não-escalada: ninguém concede/edita/remove papel de nível >= ao seu.
-- Contexto sem usuário (auth.uid() NULL = service_role/bootstrap) é liberado.
create or replace function public.enforce_role_escalation()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  acting uuid := auth.uid();
  acting_level int;
  target_level int;
  scope uuid := coalesce(new.space_id, old.space_id);
begin
  if acting is null then
    return coalesce(new, old);
  end if;

  acting_level := public.max_role_level(acting, scope);
  select level into target_level
    from public.roles where id = coalesce(new.role_id, old.role_id);

  if acting_level <= target_level then
    raise exception
      'Não é permitido conceder, editar ou remover papel de nível >= ao seu (%).',
      acting_level
      using errcode = '42501';
  end if;

  return coalesce(new, old);
end $$;

create trigger trg_membership_escalation
  before insert or update or delete on public.memberships
  for each row execute function public.enforce_role_escalation();

-- Proteção do último Owner: o sistema bloqueia a remoção/rebaixamento do último.
create or replace function public.protect_last_owner()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  owner_level constant int := 100;
  old_is_owner boolean;
  remaining int;
begin
  select (r.level = owner_level) into old_is_owner
    from public.roles r where r.id = old.role_id;

  if old_is_owner then
    select count(*) into remaining
      from public.memberships m
      join public.roles r on r.id = m.role_id
      where r.level = owner_level and m.id <> old.id;
    if remaining = 0 then
      raise exception 'Não é possível remover o último Owner do sistema.'
        using errcode = '42501';
    end if;
  end if;

  return coalesce(new, old);
end $$;

create trigger trg_protect_last_owner
  before update or delete on public.memberships
  for each row execute function public.protect_last_owner();

-- =====================================================================
-- 4. RLS
-- =====================================================================

alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.audit_log enable row level security;

-- profiles: vê o próprio; quem tem user.view vê todos; edita o próprio;
-- quem tem user.manage gerencia.
create policy profiles_select_self on public.profiles
  for select using (id = auth.uid());
create policy profiles_select_managers on public.profiles
  for select using (public.has_permission(auth.uid(), 'user.view'));
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_manage on public.profiles
  for all using (public.has_permission(auth.uid(), 'user.manage'))
  with check (public.has_permission(auth.uid(), 'user.manage'));

-- roles/permissions/role_permissions: leitura para autenticados (catálogo);
-- escrita só para role.manage.
create policy roles_read on public.roles
  for select to authenticated using (true);
create policy roles_manage on public.roles
  for all using (public.has_permission(auth.uid(), 'role.manage'))
  with check (public.has_permission(auth.uid(), 'role.manage'));

create policy permissions_read on public.permissions
  for select to authenticated using (true);
create policy permissions_manage on public.permissions
  for all using (public.has_permission(auth.uid(), 'role.manage'))
  with check (public.has_permission(auth.uid(), 'role.manage'));

create policy role_permissions_read on public.role_permissions
  for select to authenticated using (true);
create policy role_permissions_manage on public.role_permissions
  for all using (public.has_permission(auth.uid(), 'role.manage'))
  with check (public.has_permission(auth.uid(), 'role.manage'));

-- memberships: vê os próprios; quem tem user.view vê no escopo; gestão exige
-- user.manage (a não-escalada é reforçada por trigger).
create policy memberships_select_self on public.memberships
  for select using (user_id = auth.uid());
create policy memberships_select_managers on public.memberships
  for select using (public.has_permission(auth.uid(), 'user.view', space_id));
create policy memberships_insert on public.memberships
  for insert with check (public.has_permission(auth.uid(), 'user.manage', space_id));
create policy memberships_update on public.memberships
  for update using (public.has_permission(auth.uid(), 'user.manage', space_id))
  with check (public.has_permission(auth.uid(), 'user.manage', space_id));
create policy memberships_delete on public.memberships
  for delete using (public.has_permission(auth.uid(), 'user.manage', space_id));

-- invitations: gerência exige user.invite.
create policy invitations_manage on public.invitations
  for all using (public.has_permission(auth.uid(), 'user.invite', space_id))
  with check (public.has_permission(auth.uid(), 'user.invite', space_id));

-- audit_log: leitura exige audit.read; inserção por autenticados (o servidor
-- registra em nome do ator); nunca update/delete (append-only).
create policy audit_read on public.audit_log
  for select using (public.has_permission(auth.uid(), 'audit.read', space_id));
create policy audit_insert on public.audit_log
  for insert to authenticated with check (actor_id = auth.uid());

-- =====================================================================
-- 5. SEED — permissões, papéis e o mapa papel->permissões
-- =====================================================================

insert into public.permissions (key, description) values
  ('content.view',        'Ver conteúdo (inclui privado do espaço)'),
  ('content.create',      'Criar artigos/nós'),
  ('content.edit',        'Editar conteúdo'),
  ('content.delete',      'Excluir conteúdo (lixeira)'),
  ('content.publish',     'Publicar/despublicar'),
  ('content.move',        'Mover/copiar entre espaços'),
  ('content.import',      'Rodar importações'),
  ('content.restore',     'Restaurar versões/subárvores'),
  ('trash.empty',         'Esvaziar lixeira'),
  ('tree.reorganize',     'Reorganizar a árvore'),
  ('overlay.manage',      'Gerenciar overlays de cliente'),
  ('review.approve',      'Aprovar publicação'),
  ('review.reject',       'Rejeitar publicação'),
  ('review.comment',      'Comentar em rascunhos'),
  ('space.manage',        'Configurar espaços'),
  ('space.create',        'Criar espaços'),
  ('space.delete',        'Excluir espaços'),
  ('domain.manage',       'Gerenciar domínios customizados'),
  ('theme.manage',        'Gerenciar temas'),
  ('widget.manage',       'Gerenciar chaves de widget'),
  ('apikey.manage',       'Gerenciar chaves de API'),
  ('integrations.manage', 'Gerenciar integrações'),
  ('ai.configure',        'Configurar provedores de IA'),
  ('embeddings.reindex',  'Disparar reindexação de embeddings'),
  ('user.view',           'Ver usuários'),
  ('user.invite',         'Convidar usuários (níveis menores)'),
  ('user.manage',         'Gerenciar usuários e papéis'),
  ('user.suspend',        'Suspender usuários'),
  ('role.manage',         'Criar/editar papéis customizados'),
  ('audit.read',          'Ler o log de auditoria'),
  ('billing.manage',      'Gerenciar faturamento'),
  ('space.transfer',      'Transferir propriedade');

insert into public.roles (key, name, level, description, is_system) values
  ('owner',     'Owner',              100, 'Controle total, faturamento e propriedade.', true),
  ('admin_tech','Admin técnico',       80, 'Configuração do sistema e usuários (até 80).', true),
  ('content_mgr','Gestor de conteúdo', 60, 'Domínio total sobre a documentação.', true),
  ('editor',    'Editor',              40, 'Cria/edita; publicação depende de aprovação.', true),
  ('reviewer',  'Revisor',             20, 'Lê rascunhos, comenta, aprova/rejeita.', true),
  ('reader',    'Leitor',              10, 'Somente leitura, inclusive de privado.', true);

-- Leitor (10): base.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r, public.permissions p
where r.key = 'reader' and p.key in ('content.view');

-- Revisor (20): Leitor + revisão.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r, public.permissions p
where r.key = 'reviewer' and p.key in (
  'content.view', 'review.approve', 'review.reject', 'review.comment'
);

-- Editor (40): cria/edita/exclui — SEM publicar (envia para revisão).
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r, public.permissions p
where r.key = 'editor' and p.key in (
  'content.view', 'content.create', 'content.edit', 'content.delete',
  'review.comment'
);

-- Gestor de conteúdo (60): domínio total sobre documentação.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r, public.permissions p
where r.key = 'content_mgr' and p.key in (
  'content.view', 'content.create', 'content.edit', 'content.delete',
  'content.publish', 'content.move', 'content.import', 'content.restore',
  'trash.empty', 'tree.reorganize', 'overlay.manage',
  'review.approve', 'review.reject', 'review.comment',
  'user.view', 'user.invite'
);

-- Admin técnico (80): config do sistema + tudo de conteúdo (contém Gestor).
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r, public.permissions p
where r.key = 'admin_tech' and p.key in (
  'content.view', 'content.create', 'content.edit', 'content.delete',
  'content.publish', 'content.move', 'content.import', 'content.restore',
  'trash.empty', 'tree.reorganize', 'overlay.manage',
  'review.approve', 'review.reject', 'review.comment',
  'space.manage', 'space.create', 'space.delete', 'domain.manage',
  'theme.manage', 'widget.manage', 'apikey.manage', 'integrations.manage',
  'ai.configure', 'embeddings.reindex',
  'user.view', 'user.invite', 'user.manage', 'user.suspend', 'role.manage',
  'audit.read'
);

-- Owner (100): TODAS as permissões.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r, public.permissions p
where r.key = 'owner';
