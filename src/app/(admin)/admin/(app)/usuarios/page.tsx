import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { listRoles, currentMaxLevel, type Role } from "@/lib/auth/roles";
import { UsersManager } from "./users-manager";
import { RolesGuide } from "./roles-guide";
import { listAuthors, type AuthorRow } from "./author-actions";

export const metadata: Metadata = { title: "Usuários" };

/** Uma REGRA de acesso do usuário = um membership (papel + documentação + diretório). */
export type Membership = {
  id: string;
  space_id: string | null;
  space_name: string | null;
  node_id: string | null;
  node_title: string | null;
  role_key: string;
  role_name: string;
  role_level: number;
};

export type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  job_title: string | null;
  avatar_url: string | null;
  status: string;
  created_at: string;
  last_seen_at: string | null;
  memberships: Membership[];
  /** Perfil PÚBLICO de autor (1:1 com o usuário), quando existe. */
  author: AuthorRow | null;
};

export type SpaceOption = { id: string; name: string };

/** Papel com a lista de permissões que ele concede — alimenta o guia de papéis. */
export type RoleWithPerms = Role & {
  permissions: { key: string; description: string | null }[];
};

/**
 * Tela de Usuários. Grade de cartões (foto/nome/cargo) → painel por usuário que
 * reúne identidade, REGRAS de acesso por documentação/diretório, conta e perfil
 * de autor. Um guia explica cada papel. Tudo protegido por has_permission.
 */
export default async function UsuariosPage() {
  const canView = await hasPermission("user.view");
  if (!canView) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Usuários</h1>
        <p className="mt-2 text-text-muted">Você não tem permissão para ver esta área.</p>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { user: actor },
  } = await supabase.auth.getUser();

  const [
    { data: profiles },
    { data: memberships },
    { data: rolePerms },
    { data: spaces },
    roles,
    authors,
    actorLevel,
    canInvite,
    canManage,
    canSuspend,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, job_title, avatar_url, status, created_at, last_seen_at")
      .order("created_at", { ascending: true }),
    supabase
      .from("memberships")
      .select("id, user_id, space_id, node_id, roles(key, name, level)"),
    supabase.from("role_permissions").select("role_id, permissions(key, description)"),
    supabase.from("spaces").select("id, name").order("name"),
    listRoles(),
    listAuthors(),
    currentMaxLevel(null),
    hasPermission("user.invite"),
    hasPermission("user.manage"),
    hasPermission("user.suspend"),
  ]);

  const spaceName = new Map((spaces ?? []).map((s) => [s.id, s.name]));

  // Títulos dos diretórios referenciados por regras (paginado por segurança).
  const ruleNodeIds = [...new Set((memberships ?? []).map((m) => m.node_id).filter((x): x is string => !!x))];
  const nodeTitle = new Map<string, string>();
  if (ruleNodeIds.length) {
    for (let i = 0; i < ruleNodeIds.length; i += 200) {
      const fatia = ruleNodeIds.slice(i, i + 200);
      const { data } = await supabase.from("nodes").select("id, title").in("id", fatia);
      for (const n of data ?? []) nodeTitle.set(n.id, n.title);
    }
  }

  const byUser = new Map<string, Membership[]>();
  for (const m of memberships ?? []) {
    const role = m.roles as unknown as { key: string; name: string; level: number } | null;
    if (!role) continue;
    const list = byUser.get(m.user_id) ?? [];
    list.push({
      id: m.id,
      space_id: m.space_id,
      space_name: m.space_id ? spaceName.get(m.space_id) ?? null : null,
      node_id: m.node_id,
      node_title: m.node_id ? nodeTitle.get(m.node_id) ?? null : null,
      role_key: role.key,
      role_name: role.name,
      role_level: role.level,
    });
    byUser.set(m.user_id, list);
  }

  const authorById = new Map(authors.map((a) => [a.id, a]));

  const users: UserRow[] = (profiles ?? []).map((p) => ({
    ...p,
    memberships: byUser.get(p.id) ?? [],
    author: authorById.get(p.id) ?? null,
  }));

  // Permissões por papel (fonte da verdade para o guia).
  const permsByRole = new Map<string, { key: string; description: string | null }[]>();
  for (const rp of rolePerms ?? []) {
    const perm = rp.permissions as unknown as { key: string; description: string | null } | null;
    if (!perm) continue;
    const list = permsByRole.get(rp.role_id) ?? [];
    list.push(perm);
    permsByRole.set(rp.role_id, list);
  }
  const rolesWithPerms: RoleWithPerms[] = roles.map((r) => ({
    ...r,
    permissions: (permsByRole.get(r.id) ?? []).sort((a, b) => a.key.localeCompare(b.key)),
  }));

  return (
    <div className="mx-auto max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Usuários</h1>
        <p className="mt-1 text-sm text-text-muted">
          {users.length} {users.length === 1 ? "usuário" : "usuários"} · você é nível {actorLevel}
        </p>
      </div>

      <UsersManager
        users={users}
        roles={roles}
        authors={authors}
        spaces={(spaces ?? []).map((s) => ({ id: s.id, name: s.name }))}
        actorLevel={actorLevel}
        actorId={actor?.id ?? null}
        can={{ invite: canInvite, manage: canManage, suspend: canSuspend }}
      />

      <RolesGuide roles={rolesWithPerms} />
    </div>
  );
}
